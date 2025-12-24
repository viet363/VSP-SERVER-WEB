import qs from "qs";
import crypto from "crypto";
import axios from "axios";
import { db } from "../../db.js";

const MOMO_CONFIG = {
  partnerCode: "MOMO",
  accessKey: "F8BBA842ECF85",
  secretKey: "K951B6PE1waDMi640xX08PD3vg6EkVlz",
  apiUrl: "https://test-payment.momo.vn/v2/gateway/api/create",
  returnUrl: "http://192.168.1.102:4000/api/mobile/payment/momo/return",
  ipnUrl: "http://192.168.1.102:4000/api/mobile/payment/momo/ipn"
};

const VNPAY_CONFIG = {
  tmnCode: "LBU9HNGB",
  hashSecret: "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ",
  url: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  returnUrl: "http://192.168.1.102:4000/api/mobile/payment/vnpay/return"
};

const JWT_SECRET = "SECRET_KEY";

export const createMoMoUrlMobile = async (req, res) => {
  try {
    const { orderId, amount, orderInfo, extraData = "", requestType = "captureWallet" } = req.body;
    const userId = req.user.Id;

    console.log(`Creating MoMo payment for order ${orderId}, user ${userId}, amount ${amount}`);

    const [orders] = await db.query(
      `SELECT o.*, p.Amount, p.Id as paymentId
       FROM orders o
       LEFT JOIN payment p ON o.Id = p.OrderId
       WHERE o.Id = ? AND o.UserId = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy đơn hàng" 
      });
    }

    const order = orders[0];

    if (order.Order_status === 'Paid' || order.Order_status === 'Processing') {
      return res.status(400).json({ 
        success: false, 
        message: "Đơn hàng đã được thanh toán" 
      });
    }

    if (order.Payment_type !== 'Momo') {
      await db.query(
        `UPDATE orders SET Payment_type = 'Momo' WHERE Id = ?`,
        [orderId]
      );
    }

    const paymentAmount = amount || order.total || 0;
    if (!order.paymentId) {
      await db.query(
        `INSERT INTO payment 
         (OrderId, Payment_method, Amount, Payment_status)
         VALUES (?, 'Momo', ?, 'Pending')`,
        [orderId, paymentAmount]
      );
    } else {
      await db.query(
        `UPDATE payment 
         SET Payment_method = 'Momo', 
             Amount = ?,
             Payment_status = 'Pending'
         WHERE OrderId = ?`,
        [paymentAmount, orderId]
      );
    }

    const requestId = `${MOMO_CONFIG.partnerCode}${Date.now()}`;
    const momoOrderId = `MOMO${orderId}${Date.now()}`;
    const redirectUrl = `${MOMO_CONFIG.returnUrl}?orderId=${orderId}&userId=${userId}`;
    const ipnUrl = MOMO_CONFIG.ipnUrl;
    
    const lang = "vi";
    const amountInt = Math.round(paymentAmount); 

    const rawSignature = `accessKey=${MOMO_CONFIG.accessKey}&amount=${amountInt}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_CONFIG.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    
    console.log("Raw signature for MoMo:", rawSignature);
    
    const signature = crypto
      .createHmac("sha256", MOMO_CONFIG.secretKey)
      .update(rawSignature)
      .digest("hex");

    console.log("Generated signature:", signature);

    const requestBody = {
      partnerCode: MOMO_CONFIG.partnerCode,
      accessKey: MOMO_CONFIG.accessKey,
      requestId,
      amount: amountInt,
      orderId: momoOrderId,
      orderInfo: orderInfo || `Thanh toán đơn hàng ${orderId}`,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang
    };

    console.log("Sending request to MoMo:", JSON.stringify(requestBody, null, 2));

    const momoResponse = await axios.post(
      MOMO_CONFIG.apiUrl,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    console.log("MoMo API response:", momoResponse.data);

    if (momoResponse.data.resultCode && momoResponse.data.resultCode !== 0) {
      return res.status(400).json({
        success: false,
        message: `MoMo lỗi: ${momoResponse.data.message}`,
        errorCode: momoResponse.data.resultCode
      });
    }

    await db.query(
      `UPDATE payment 
       SET Transaction_code = ? 
       WHERE OrderId = ? AND Payment_method = 'Momo'`,
      [momoOrderId, orderId]
    );

    res.json({
      success: true,
      payUrl: momoResponse.data.payUrl,
      orderId: orderId,
      amount: paymentAmount,
      momoOrderId: momoOrderId,
      message: "Tạo liên kết thanh toán MoMo thành công"
    });

  } catch (error) {
    console.error("Error creating MoMo URL:", error);
    
    if (error.response) {
      console.error("MoMo API error response:", error.response.data);
      console.error("MoMo API error status:", error.response.status);
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server khi tạo thanh toán MoMo",
      error: error.message
    });
  }
};

export const momoReturnMobile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { orderId, userId } = req.query;
    const { resultCode, message, orderId: momoOrderId, transId } = req.query;

    console.log("MoMo return callback received:", req.query);

    if (!orderId || !userId) {
      console.error("Missing parameters in MoMo return");
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin đơn hàng hoặc người dùng" 
      });
    }

    const [orderCheck] = await connection.query(
      "SELECT * FROM orders WHERE Id = ? AND UserId = ?",
      [orderId, userId]
    );

    if (orderCheck.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Đơn hàng không thuộc về người dùng này"
      });
    }

    const isSuccess = resultCode === '0' || resultCode === '9000' || resultCode === '1000';

    if (isSuccess) {
      await connection.query(
        `UPDATE orders 
         SET Order_status = 'Processing', 
             Paid_date = NOW(),
             Update_at = NOW()
         WHERE Id = ?`,
        [orderId]
      );

      await connection.query(
        `UPDATE payment 
         SET Payment_status = 'Success',
             Transaction_code = ?,
             Paid_at = NOW()
         WHERE OrderId = ? AND Payment_method = 'Momo'`,
        [momoOrderId || transId, orderId]
      );

      await connection.commit();

      return res.json({
        success: true,
        message: "Thanh toán MoMo thành công",
        orderId: orderId,
        transactionId: momoOrderId || transId
      });

    } else {
      const errorMessages = {
        '11': 'Đã hết hạn thanh toán',
        '12': 'Thẻ/tài khoản bị khóa',
        '13': 'Sai mật khẩu/OTP',
        '24': 'Khách hàng hủy giao dịch',
        '51': 'Tài khoản không đủ số dư',
        '65': 'Vượt quá hạn mức giao dịch',
        '75': 'Ngân hàng bảo trì',
        '79': 'Sai mật khẩu quá nhiều lần',
        '99': 'Lỗi không xác định'
      };

      const errorMessage = errorMessages[resultCode] || message || 'Thanh toán thất bại';

      await connection.query(
        `UPDATE payment 
         SET Payment_status = 'Failed'
         WHERE OrderId = ? AND Payment_method = 'Momo'`,
        [orderId]
      );

      await connection.query(
        `UPDATE orders 
         SET Order_status = 'Pending',
             Update_at = NOW()
         WHERE Id = ?`,
        [orderId]
      );

      await connection.commit();

      return res.json({
        success: false,
        message: errorMessage,
        responseCode: resultCode
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error("Error processing MoMo return:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server nội bộ khi xử lý MoMo"
    });
  } finally {
    connection.release();
  }
};

export const momoIPN = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const momoData = req.body;
    console.log("MoMo IPN received:", momoData);

    const secretKey = MOMO_CONFIG.secretKey;
    
    const rawSignature = `accessKey=${momoData.accessKey}&amount=${momoData.amount}&extraData=${momoData.extraData}&message=${momoData.message}&orderId=${momoData.orderId}&orderInfo=${momoData.orderInfo}&orderType=${momoData.orderType}&partnerCode=${momoData.partnerCode}&payType=${momoData.payType}&requestId=${momoData.requestId}&responseTime=${momoData.responseTime}&resultCode=${momoData.resultCode}&transId=${momoData.transId}`;
    
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    if (signature !== momoData.signature) {
      console.error("Invalid MoMo IPN signature!");
      await connection.rollback();
      return res.status(400).json({
        RspCode: 97,
        Message: "Invalid signature"
      });
    }

    const momoOrderId = momoData.orderId;
    const orderIdMatch = momoOrderId.match(/MOMO(\d+)/);
    
    if (!orderIdMatch) {
      console.error("Cannot extract orderId from MoMo orderId:", momoOrderId);
      await connection.rollback();
      return res.status(400).json({
        RspCode: 99,
        Message: "Invalid orderId format"
      });
    }

    const orderId = orderIdMatch[1];

    if (momoData.resultCode === 0) {
      await connection.query(
        `UPDATE orders 
         SET Order_status = 'Processing', 
             Paid_date = NOW(),
             Update_at = NOW()
         WHERE Id = ?`,
        [orderId]
      );

      await connection.query(
        `UPDATE payment 
         SET Payment_status = 'Success',
             Transaction_code = ?,
             Paid_at = NOW()
         WHERE OrderId = ? AND Payment_method = 'Momo'`,
        [momoData.transId, orderId]
      );

      await connection.commit();

      return res.json({
        RspCode: 0,
        Message: "Success"
      });
    } else {
      await connection.query(
        `UPDATE payment 
         SET Payment_status = 'Failed'
         WHERE OrderId = ? AND Payment_method = 'Momo'`,
        [orderId]
      );

      await connection.query(
        `UPDATE orders 
         SET Order_status = 'Pending',
             Update_at = NOW()
         WHERE Id = ?`,
        [orderId]
      );

      await connection.commit();

      return res.json({
        RspCode: 0,
        Message: "Success"
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error("MoMo IPN error:", error);
    return res.status(500).json({
      RspCode: 99,
      Message: "Internal server error"
    });
  } finally {
    connection.release();
  }
};

export { MOMO_CONFIG, VNPAY_CONFIG, JWT_SECRET };