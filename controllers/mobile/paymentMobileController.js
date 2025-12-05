import qs from "qs";
import crypto from "crypto";
import { db } from "../../db.js";

export const createVNPayUrlMobile = async (req, res) => {
  try {
    const { orderId, amount } = req.query;

    const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl = "http://localhost:4000/api/mobile/payment/return";

    const vnp_TmnCode = "LBU9HNGB";
    const vnp_HashSecret = "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";

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

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    let params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode,
      vnp_Amount: amount * 100,
      vnp_CreateDate: createDate,
      vnp_CurrCode: "VND",
      vnp_IpAddr: ipAddr,
      vnp_Locale: "vn",
      vnp_OrderInfo: `Thanh toán đơn hàng ${orderId}`,
      vnp_OrderType: "other",
      vnp_ReturnUrl,
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

    console.log("Generated VNPay URL for order:", orderId);
    res.json({ success: true, paymentUrl });
  } catch (error) {
    console.error("Error creating VNPay URL:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const vnpayReturnMobile = async (req, res) => {
  try {
    let vnp_Params = req.query;
    const secureHash = vnp_Params.vnp_SecureHash;

    const vnp_SecureHash = secureHash;
    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnp_Params[key];
        return acc;
      }, {});

    const signData = qs.stringify(sortedParams, { encode: false });
    const vnp_HashSecret = "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";
    
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    console.log("VNPay Return - Received hash:", vnp_SecureHash);
    console.log("VNPay Return - Calculated hash:", signed);

    if (secureHash !== signed) {
      console.error("Invalid signature!");
      console.log("Sign data:", signData);
      return res.json({
        success: false,
        message: "Chữ ký không hợp lệ",
        receivedHash: secureHash,
        calculatedHash: signed,
      });
    }

    const responseCode = vnp_Params.vnp_ResponseCode;

    if (responseCode === "00") {
      const vnp_TxnRef = vnp_Params.vnp_TxnRef;
      const orderId = vnp_TxnRef.includes('-') 
        ? vnp_TxnRef.split('-')[1] 
        : vnp_TxnRef;
      
      const amount = parseInt(vnp_Params.vnp_Amount) / 100;

      console.log(`Updating order ${orderId} to Paid status`);

      await db.query(
        `UPDATE orders 
         SET Order_status = 'Paid', Paid_date = NOW() 
         WHERE Id = ?`,
        [orderId]
      );

      return res.json({
        success: true,
        message: "Thanh toán thành công",
        orderId,
        amount,
      });
    }

    return res.json({
      success: false,
      message: "Thanh toán thất bại",
      responseCode,
    });
  } catch (error) {
    console.error("Error processing VNPay return:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};