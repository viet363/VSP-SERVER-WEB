import jwt from "jsonwebtoken";
import { db } from "../db.js";

const mobileAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "Thiếu token xác thực" 
      });
    }
    
    const token = authHeader.split(" ")[1];
    
    const decoded = jwt.verify(token, "SECRET_KEY"); 
    
    const [[user]] = await db.query(
      "SELECT Id, Username, Email, Fullname, Avatar, Phone FROM user WHERE Id = ?",
      [decoded.id || decoded.userId]
    );
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: "Người dùng không tồn tại" 
      });
    }
    
    req.userId = user.Id;
    req.user = user;
    
    next();
    
  } catch (error) {
    console.error("Mobile auth error:", error);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        success: false, 
        message: "Token không hợp lệ" 
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false, 
        message: "Token đã hết hạn" 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: "Lỗi xác thực" 
    });
  }
};

export default mobileAuth;
export { mobileAuth }; 