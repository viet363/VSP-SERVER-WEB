import qs from "qs";
import crypto from "crypto";

export const createVNPayUrlMobile = async (req, res) => {
  try {
    const { orderId, amount } = req.query;

    const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const vnp_ReturnUrl = "http://192.168.3.84:4000/api/mobile/payment/return";

    const vnp_TmnCode = "LBU9HNGB";
    const vnp_HashSecret = "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";

    function formatDate(date) {
      const Y = date.getFullYear();
      const M = ("0" + (date.getMonth() + 1)).slice(-2);
      const D = ("0" + date.getDate()).slice(-2);
      const H = ("0" + date.getHours()).slice(-2);
      const m = ("0" + date.getMinutes()).slice(-2);
      const s = ("0" + date.getSeconds()).slice(-2);
      return `${Y}${M}${D}${H}${m}${s}`;
    }

    const createDate = formatDate(new Date());

    const ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
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
      vnp_TxnRef: orderId,
    };

    const sorted = Object.keys(params)
      .sort()
      .reduce((acc, key) => ({ ...acc, [key]: params[key] }), {});

    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    sorted["vnp_SecureHash"] = signed;

    const paymentUrl = vnp_Url + "?" + qs.stringify(sorted, { encode: false });

    res.json({ success: true, paymentUrl });
  } catch (error) {
    console.error("Error creating VNPay URL:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const vnpayReturnMobile = async (req, res) => {
  try {
    const vnp_Params = req.query;
    const secureHash = vnp_Params["vnp_SecureHash"];

    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    // Sắp xếp tham số theo thứ tự alphabet
    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = vnp_Params[key];
        return acc;
      }, {});

    // Tạo chuỗi dữ liệu để hash
    const signData = qs.stringify(sortedParams, { encode: false });

    // Hash dữ liệu
    const vnp_HashSecret = "8AY3Q3OC7IML0WOWLMBX9ZZGFLDB8TDZ";
    const hmac = crypto.createHmac("sha512", vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Kiểm tra chữ ký
    if (secureHash === signed) {
      const vnp_ResponseCode = vnp_Params["vnp_ResponseCode"];

      if (vnp_ResponseCode === "00") {
        // Thanh toán thành công
        const orderId = vnp_Params["vnp_TxnRef"];
        const amount = parseInt(vnp_Params["vnp_Amount"]) / 100;

        // TODO: Thêm logic cập nhật đơn hàng ở đây

        res.json({
          success: true,
          message: "Thanh toán thành công",
          orderId,
          amount
        });
      } else {
        // Thanh toán thất bại
        res.json({
          success: false,
          message: "Thanh toán thất bại",
          responseCode: vnp_ResponseCode
        });
      }
    } else {
      res.json({
        success: false,
        message: "Chữ ký không hợp lệ"
      });
    }
  } catch (error) {
    console.error("Error processing VNPay return:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};