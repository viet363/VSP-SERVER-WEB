import qs from "qs";
import crypto from "crypto";
import { db } from "../../db.js";

export const createVNPayUrlMobile = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const userId = req.user.Id;

    const [orders] = await db.query(
      "SELECT * FROM orders WHERE Id = ? AND UserId = ?",
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy đơn hàng" 
      });
    }

    const order = orders[0];

    if (order.Order_status === 'Paid') {
      return res.status(400).json({ 
        success: false, 
        message: "Đơn hàng đã được thanh toán" 
      });
    }

    const vnp_Url = process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl = process.env.VNPAY_RETURN_URL || "http://localhost:4000/api/mobile/payment/return";
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
      vnp_ReturnUrl: `${vnp_ReturnUrl}?userId=${userId}`,
      vnp_TxnRef: `${Date.now()}-${orderId}-${userId}`,
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
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const vnpayReturnMobile = async (req, res) => {
  try {
    let vnp_Params = req.query;
    
    console.log("VNPay Return - Received params:", vnp_Params);

    if (!vnp_Params.vnp_ResponseCode || !vnp_Params.vnp_TxnRef) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu tham số bắt buộc" 
      });
    }

    const secureHash = vnp_Params.vnp_SecureHash;
    const vnp_ParamsCopy = { ...vnp_Params };
    
    delete vnp_ParamsCopy.vnp_SecureHash;
    delete vnp_ParamsCopy.vnp_SecureHashType;

    const sortedParams = Object.keys(vnp_ParamsCopy)
      .sort()
      .reduce((acc, key) => {
        if (vnp_ParamsCopy[key]) {
          acc[key] = vnp_ParamsCopy[key];
        }
        return acc;
      }, {});

    const signData = qs.stringify(sortedParams, { encode: false });
    const vnp_HashSecret = process.env.VNPAY_HASH_SECRET || "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";
    
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    if (secureHash !== signed) {
      console.error("Invalid signature!");
      console.log("Expected:", secureHash);
      console.log("Calculated:", signed);
      
      return res.status(400).json({
        success: false,
        message: "Chữ ký không hợp lệ"
      });
    }

    const responseCode = vnp_Params.vnp_ResponseCode;

    const txnRefParts = vnp_Params.vnp_TxnRef.split('-');
    if (txnRefParts.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Mã giao dịch không hợp lệ"
      });
    }

    const orderId = txnRefParts[1];
    const userId = txnRefParts[2];

    if (responseCode === "00") {
      const amount = parseInt(vnp_Params.vnp_Amount) / 100;

      console.log(`Payment successful for order ${orderId}, amount: ${amount}`);

      const connection = await db.getConnection();
      
      try {
        await connection.beginTransaction();

        await connection.query(
          `UPDATE orders 
           SET Order_status = 'Processing', 
               Paid_date = NOW(),
               Update_at = NOW()
           WHERE Id = ? AND UserId = ?`,
          [orderId, userId]
        );

        await connection.query(
          `UPDATE payment 
           SET Payment_status = 'Success',
               Transaction_code = ?,
               Paid_at = NOW()
           WHERE OrderId = ? AND Payment_method = 'VNPay'`,
          [vnp_Params.vnp_TransactionNo || vnp_Params.vnp_TxnRef, orderId]
        );

        const [payments] = await connection.query(
          "SELECT Id FROM payment WHERE OrderId = ?",
          [orderId]
        );

        if (payments.length === 0) {
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

      } catch (error) {
        await connection.rollback();
        console.error("Error updating payment status:", error);
        return res.status(500).json({
          success: false,
          message: "Lỗi cập nhật trạng thái thanh toán"
        });
      } finally {
        connection.release();
      }
    } else {
      const errorMessages = {
        "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).",
        "09": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.",
        "10": "Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
        "11": "Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.",
        "12": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.",
        "13": "Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.",
        "24": "Giao dịch không thành công do: Khách hàng hủy giao dịch",
        "51": "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.",
        "65": "Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.",
        "75": "Ngân hàng thanh toán đang bảo trì.",
        "79": "Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch",
        "99": "Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)"
      };

      const errorMessage = errorMessages[responseCode] || "Thanh toán thất bại";

      try {
        await db.query(
          `UPDATE payment 
           SET Payment_status = 'Failed'
           WHERE OrderId = ? AND Payment_method = 'VNPay'`,
          [orderId]
        );
      } catch (error) {
        console.error("Error updating failed payment:", error);
      }

      return res.json({
        success: false,
        message: errorMessage,
        responseCode: responseCode
      });
    }
  } catch (error) {
    console.error("Error processing VNPay return:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server nội bộ",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.Id;

    // Kiểm tra order thuộc về user
    const [orders] = await db.query(
      "SELECT Order_status FROM orders WHERE Id = ? AND UserId = ?",
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy đơn hàng" 
      });
    }

    const [payments] = await db.query(
      "SELECT Payment_status, Transaction_code, Paid_at FROM payment WHERE OrderId = ?",
      [orderId]
    );

    res.json({
      success: true,
      orderStatus: orders[0].Order_status,
      payment: payments[0] || null
    });

  } catch (error) {
    console.error("Check payment status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};