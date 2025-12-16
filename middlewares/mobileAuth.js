import jwt from "jsonwebtoken";
import { db } from "../db.js";

const mobileAuth = async (req, res, next) => {
  try {
    console.log("=== MOBILE AUTH DEBUG ===");
    const authHeader = req.headers.authorization;
    console.log("Authorization header:", authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No Bearer token found");
      return res.status(401).json({ 
        success: false, 
        message: "Thiếu token xác thực" 
      });
    }
    
    const token = authHeader.split(" ")[1];
    console.log("Token extracted, length:", token.length);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "SECRET_KEY");
    console.log("Token decoded:", decoded);
    
    const userId = decoded.id || decoded.userId || decoded.Id;
    console.log("Extracted userId from token:", userId);
    
    if (!userId) {
      console.log("No userId found in token");
      return res.status(401).json({ 
        success: false, 
        message: "Token không chứa thông tin người dùng" 
      });
    }
    
    const [[user]] = await db.query(
      "SELECT Id, Username, Email, Fullname, Avatar, Phone FROM user WHERE Id = ?",
      [userId]
    );
    
    console.log("User found in database:", user);
    
    if (!user) {
      console.log("User not found in database");
      return res.status(401).json({ 
        success: false, 
        message: "Người dùng không tồn tại" 
      });
    }
    
    // QUAN TRỌNG: Gán cả userId và user với id property
    req.userId = user.Id;
    req.user = {
      id: user.Id,  // Đảm bảo có property id
      ...user
    };
    
    console.log("req.userId set to:", req.userId);
    console.log("req.user.id set to:", req.user.id);
    console.log("=== MOBILE AUTH SUCCESS ===");
    
    next();
    
  } catch (error) {
    console.error("Mobile auth error:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
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
      message: "Lỗi xác thực: " + error.message 
    });
  }
};

export { mobileAuth };
export default mobileAuth;