import qs from "qs";
import crypto from "crypto";
import { db } from "../../db.js";

export const createVNPayUrlMobile = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.Id;

    const [orders] = await db.query(
      `SELECT o.*, p.Amount, p.Id as paymentId
       FROM orders o
       LEFT JOIN payment p ON o.Id = p.OrderId
       WHERE o.Id = ? AND o.UserId = ? AND o.Payment_type = 'VNPay'`,
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

    if (!order.paymentId) {
      const [paymentResult] = await db.query(
        `INSERT INTO payment 
         (OrderId, Payment_method, Amount, Payment_status)
         VALUES (?, 'VNPay', ?, 'Pending')`,
        [orderId, order.Amount || order.total]
      );
    }

    const vnp_Url = process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl = process.env.VNPAY_RETURN_URL || "http://192.168.1.102:4000/api/mobile/payment/return";
    const vnp_TmnCode = process.env.VNPAY_TMN_CODE || "LBU9HNGB";
    const vnp_HashSecret = process.env.VNPAY_HASH_SECRET || "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";

    const date = new Date();
    const createDate = `${date.getFullYear()}${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}${date
      .getHours()
      .toString()
      .padStart(2, "0")}${date.getMinutes().toString().padStart(2, "0")}${date
      .getSeconds()
      .toString()
      .padStart(2, "0")}`;

    const ipAddr = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress || 
                   "127.0.0.1";

    const amount = order.Amount || order.total;
    
    let params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode,
      vnp_Amount: Math.round(amount * 100), 
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: ipAddr,
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toán đơn hàng ${orderId}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl: `${vnp_ReturnUrl}?orderId=${orderId}&userId=${userId}`,
      vnp_TxnRef: `${Date.now()}-${orderId}`,
    };

    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    sorted.vnp_SecureHash = signed;

    const paymentUrl = vnp_Url + "?" + qs.stringify(sorted, { encode: false });

    console.log(`Generated VNPay URL for order ${orderId}, user ${userId}`);
    
    res.json({ 
      success: true, 
      paymentUrl,
      orderId: orderId,
      amount: amount
    });
    
  } catch (error) {
    console.error("Error creating VNPay URL:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error"
    });
  }
};

export const vnpayReturnMobile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    let vnp_Params = req.query;
    
    console.log("VNPay Return - Received params:", vnp_Params);

    const orderId = req.query.orderId;
    const userId = req.query.userId;

    if (!orderId || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin đơn hàng hoặc người dùng" 
      });
    }

    const secureHash = vnp_Params.vnp_SecureHash;
    const vnp_ParamsCopy = { ...vnp_Params };
    
    delete vnp_ParamsCopy.vnp_SecureHash;
    delete vnp_ParamsCopy.vnp_SecureHashType;

    const sortedParams = Object.keys(vnp_ParamsCopy)
      .sort()
      .filter(key => vnp_ParamsCopy[key] !== '' && vnp_ParamsCopy[key] !== null && vnp_ParamsCopy[key] !== undefined)
      .reduce((acc, key) => {
        acc[key] = vnp_ParamsCopy[key];
        return acc;
      }, {});

    const signData = qs.stringify(sortedParams, { encode: false });
    const vnp_HashSecret = process.env.VNPAY_HASH_SECRET || "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";
    
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash !== signed) {
      console.error("Invalid signature!");
      return res.status(400).json({
        success: false,
        message: "Chữ ký không hợp lệ"
      });
    }

    const responseCode = vnp_Params.vnp_ResponseCode;

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

    if (responseCode === "00") {
      const amount = parseInt(vnp_Params.vnp_Amount) / 100;

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
         WHERE OrderId = ? AND Payment_method = 'VNPay'`,
        [vnp_Params.vnp_TransactionNo || vnp_Params.vnp_TxnRef, orderId]
      );

      const [existingPayment] = await connection.query(
        "SELECT Id FROM payment WHERE OrderId = ?",
        [orderId]
      );

      if (existingPayment.length === 0) {
        await connection.query(
          `INSERT INTO payment 
           (OrderId, Payment_method, Amount, Payment_status, Transaction_code, Paid_at)
           VALUES (?, 'VNPay', ?, 'Success', ?, NOW())`,
          [orderId, amount, vnp_Params.vnp_TransactionNo || vnp_Params.vnp_TxnRef]
        );
      }

      await connection.commit();

      return res.json({
        success: true,
        message: "Thanh toán thành công",
        orderId: orderId,
        amount: amount,
        transactionId: vnp_Params.vnp_TransactionNo || vnp_Params.vnp_TxnRef
      });

    } else {
      const errorMessages = {
        "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ.",
        "09": "Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking.",
        "10": "Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
        "11": "Đã hết hạn chờ thanh toán.",
        "12": "Thẻ/Tài khoản bị khóa.",
        "13": "Sai mật khẩu xác thực giao dịch (OTP).",
        "24": "Khách hàng hủy giao dịch",
        "51": "Tài khoản không đủ số dư.",
        "65": "Tài khoản đã vượt quá hạn mức giao dịch trong ngày.",
        "75": "Ngân hàng thanh toán đang bảo trì.",
        "79": "Sai mật khẩu thanh toán quá số lần quy định.",
        "99": "Lỗi không xác định"
      };

      const errorMessage = errorMessages[responseCode] || "Thanh toán thất bại";

      await connection.query(
        `UPDATE payment 
         SET Payment_status = 'Failed'
         WHERE OrderId = ? AND Payment_method = 'VNPay'`,
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
        responseCode: responseCode
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error("Error processing VNPay return:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server nội bộ"
    });
  } finally {
    connection.release();
  }
};

export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.Id;

    const [orders] = await db.query(
      `SELECT o.*, p.Payment_status, p.Transaction_code, p.Paid_at
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

    res.json({
      success: true,
      orderStatus: order.Order_status,
      paymentStatus: order.Payment_status,
      transactionCode: order.Transaction_code,
      paidAt: order.Paid_at
    });

  } catch (error) {
    console.error("Check payment status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};