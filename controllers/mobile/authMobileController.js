import { db } from "../../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(
  "538712076460-vhocm7aajmm3tk83m030f4ujphau713g.apps.googleusercontent.com"
);

export const mobileLogin = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if ((!username && !email) || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập username/email và mật khẩu"
      });
    }

    let user;
    let query;
    let params;

    if (username) {
      query = "SELECT * FROM user WHERE Username = ?";
      params = [username];
    } else {
      query = "SELECT * FROM user WHERE Email = ?";
      params = [email];
    }

    const [users] = await db.query(query, params);
    user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Sai tài khoản hoặc mật khẩu"
      });
    }

    if (user.LoginType === 'google') {
      return res.status(401).json({
        success: false,
        message: "Tài khoản này đã đăng ký bằng Google. Vui lòng đăng nhập bằng Google."
      });
    }

    if (!user.Password) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không có mật khẩu. Vui lòng sử dụng phương thức đăng nhập khác."
      });
    }

    const match = await bcrypt.compare(password, user.Password);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Sai tài khoản hoặc mật khẩu"
      });
    }

    const token = jwt.sign(
      { id: user.Id, role: "USER" },
      "SECRET_KEY",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      id: user.Id,
      username: user.Username,
      email: user.Email,
      fullname: user.Fullname,
      gender: user.Gender,
      birthday: user.Birthday,
      avatar: user.Avatar,
      phone: user.Phone,
      createAt: user.Create_at,
      updateAt: user.Update_at,
      token: token,
      loginType: user.LoginType || "email"
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server"
    });
  }
};

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}

export const mobileLoginWithGoogle = async (req, res) => {
  const { idToken } = req.body;

  console.log("=== GOOGLE LOGIN DEBUG ===");
  console.log("Google Login - Received idToken");

  try {
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: "Thiếu token Google"
      });
    }

    const decodedToken = decodeJWT(idToken);
    if (!decodedToken) {
      return res.status(400).json({
        success: false,
        message: "Token không đúng định dạng"
      });
    }

    console.log("Decoded token info:");
    console.log("- Audience (aud):", decodedToken.aud);
    console.log("- Authorized party (azp):", decodedToken.azp);
    console.log("- Email:", decodedToken.email);
    console.log("- Issuer:", decodedToken.iss);
    console.log("- Expires:", new Date(decodedToken.exp * 1000));
    console.log("- Issued at:", new Date(decodedToken.iat * 1000));
    
    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp && decodedToken.exp < currentTime) {
      console.log("Token đã hết hạn!");
      return res.status(400).json({
        success: false,
        message: "Token Google đã hết hạn. Vui lòng đăng nhập lại."
      });
    }

    const validAudiences = [
      "538712076460-vhocm7aajmm3tk83m030f4ujphau713g.apps.googleusercontent.com", // Web Client ID
      "538712076460-abe9pms62q8qfobboq7eg9u75solisna.apps.googleusercontent.com", // Android Client ID
      decodedToken.aud,
      decodedToken.azp 
    ].filter(Boolean); 

    const uniqueAudiences = [...new Set(validAudiences)];
    console.log("Trying audiences:", uniqueAudiences);

    let payload = null;
    let lastError = null;

    for (const audience of uniqueAudiences) {
      try {
        console.log(`Trying to verify with audience: ${audience}`);
        const ticket = await googleClient.verifyIdToken({
          idToken: idToken,
          audience: audience
        });
        payload = ticket.getPayload();
        console.log(`✅ Successfully verified with audience: ${audience}`);
        break;
      } catch (err) {
        lastError = err;
        console.log(`❌ Failed with audience ${audience}: ${err.message}`);
        continue;
      }
    }

    if (!payload) {
      console.log("All verification attempts failed, using decoded token (DEVELOPMENT ONLY)");
      console.log("Last error:", lastError?.message);
      
      // CHO DEVELOPMENT: Sử dụng token đã decode (KHÔNG BẢO MẬT)
      // CHỈ DÙNG CHO TESTING, KHÔNG DÙNG CHO PRODUCTION
      console.log("DEVELOPMENT MODE: Using unverified token");
      payload = decodedToken;
    }

    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Không thể lấy email từ Google"
      });
    }

    console.log("Processing user with email:", email);

    // Tìm user bằng email
    console.log("Google Login - Searching for user with email:", email);
    const [users] = await db.query(
      "SELECT * FROM user WHERE Email = ?",
      [email]
    ).catch(error => {
      console.error("Database query error:", error);
      throw error;
    });

    console.log("Google Login - Found users:", users.length);
    let user = users[0];

    // Nếu user chưa tồn tại, tạo mới
    if (!user) {
      console.log("Google Login - User not found, creating new user");
      let baseUsername = email.split('@')[0];
      let username = baseUsername;
      let counter = 1;

      while (true) {
        const [existingUsers] = await db.query(
          "SELECT * FROM user WHERE Username = ?",
          [username]
        );
        if (existingUsers.length === 0) break;
        username = `${baseUsername}${counter}`;
        counter++;
        if (counter > 10) {
          username = `${baseUsername}_${Date.now()}`;
          break;
        }
      }

      console.log("Google Login - Creating user with username:", username);
      
      const [result] = await db.query(
        "INSERT INTO user (Username, Email, Fullname, Avatar, GoogleId, LoginType, Password) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [username, email, name || username, picture || null, googleId, 'google', null]
      ).catch(error => {
        console.error("Database insert error:", error);
        console.error("SQL Error details:", error.sql, error.sqlMessage);
        throw error;
      });

      console.log("Google Login - User created with ID:", result.insertId);

      const [newUsers] = await db.query(
        "SELECT * FROM user WHERE Id = ?",
        [result.insertId]
      );
      user = newUsers[0];
      console.log("Google Login - New user retrieved:", user);
    } else {
      console.log("Google Login - Existing user found:", user);
      // Nếu user tồn tại nhưng không phải đăng ký bằng Google
      if (user.LoginType !== 'google' && !user.GoogleId) {
        console.log("Google Login - User registered with email/password, not Google");
        return res.status(400).json({
          success: false,
          message: "Email này đã được đăng ký bằng username/password. Vui lòng đăng nhập bằng mật khẩu."
        });
      }

      console.log("Google Login - Updating user Google info");
      await db.query(
        "UPDATE user SET Fullname = ?, Avatar = ?, GoogleId = ?, LoginType = ? WHERE Id = ?",
        [name || user.Fullname, picture || user.Avatar, googleId, 'google', user.Id]
      );

      const [updatedUsers] = await db.query(
        "SELECT * FROM user WHERE Id = ?",
        [user.Id]
      );
      user = updatedUsers[0];
    }

    const token = jwt.sign(
      { id: user.Id, role: "USER" },
      "SECRET_KEY",
      { expiresIn: "7d" }
    );

    console.log("✅ Google login successful for user:", email);

    const response = {
      success: true,
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        fullname: user.Fullname,
        gender: user.Gender,
        birthday: user.Birthday,
        avatar: user.Avatar,
        phone: user.Phone,
        createAt: user.Create_at,
        updateAt: user.Update_at,
        token: token,
        loginType: user.LoginType
      }
    };

    console.log("Sending response to client");
    res.json(response);

  } catch (error) {
    console.error("❌ Google login error:", error);
    console.error("Error stack:", error.stack);
    
    // Check specific error types
    if (error.message.includes("Token used too late") || error.message.includes("expired")) {
      return res.status(400).json({
        success: false,
        message: "Token Google đã hết hạn"
      });
    }
    
    if (error.message.includes("Invalid token") || error.message.includes("Wrong recipient")) {
      return res.status(400).json({
        success: false,
        message: "Token Google không hợp lệ"
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Lỗi xác thực Google: " + error.message
    });
  }
};

export const mobileRegister = async (req, res) => {
  const { username, password, email, fullname } = req.body;

  try {
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin"
      });
    }

    const [existingUsers] = await db.query(
      "SELECT * FROM user WHERE Username = ? OR Email = ?",
      [username, email]
    );

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.Username === username) {
        return res.status(400).json({
          success: false,
          message: "Username đã tồn tại"
        });
      }
      if (existingUser.Email === email) {
        return res.status(400).json({
          success: false,
          message: "Email đã tồn tại"
        });
      }
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      "INSERT INTO user (Username, Password, Email, Fullname, LoginType) VALUES (?, ?, ?, ?, ?)",
      [username, hash, email, fullname || username, 'email']
    );

    // Tạo cart cho user
    await db.query(
      "INSERT INTO cart (UserId) VALUES (?)",
      [result.insertId]
    );

    res.json({
      success: true,
      message: "Đăng ký thành công",
      userId: result.insertId
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server"
    });
  }
};

// Thêm hàm debug để test token
export const debugGoogleToken = async (req, res) => {
  const { idToken } = req.body;

  try {
    if (!idToken) {
      return res.status(400).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const decoded = decodeJWT(idToken);
    if (!decoded) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid token format" 
      });
    }

    // Kiểm tra thời gian
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = decoded.exp && decoded.exp < currentTime;
    
    res.json({
      success: true,
      decoded: decoded,
      audience: decoded.aud,
      azp: decoded.azp,
      email: decoded.email,
      name: decoded.name,
      expiresAt: new Date(decoded.exp * 1000),
      issuedAt: new Date(decoded.iat * 1000),
      isExpired: isExpired,
      currentServerTime: new Date(),
      serverTimestamp: currentTime,
      timeRemaining: isExpired ? 0 : (decoded.exp - currentTime)
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Hàm cho development (không cần verify token)
export const mobileLoginWithGoogleDev = async (req, res) => {
  const { email, name, picture } = req.body;

  console.log("DEVELOPMENT MODE: Bypassing Google verification");

  try {
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Thiếu email"
      });
    }

    // CHO DEVELOPMENT: Dùng email từ request
    const userEmail = email;
    const userName = name || "Test User";
    const userPicture = picture || "https://example.com/avatar.jpg";
    const googleId = "dev_google_id_" + Date.now();

    console.log("Using email:", userEmail);

    // Tìm hoặc tạo user
    const [users] = await db.query(
      "SELECT * FROM user WHERE Email = ?",
      [userEmail]
    );
    
    let user = users[0];

    if (!user) {
      let username = userEmail.split('@')[0];
      
      const [result] = await db.query(
        "INSERT INTO user (Username, Email, Fullname, Avatar, GoogleId, LoginType, Password) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [username, userEmail, userName, userPicture, googleId, 'google', null]
      );

      const [newUsers] = await db.query(
        "SELECT * FROM user WHERE Id = ?",
        [result.insertId]
      );
      user = newUsers[0];
    }

    const token = jwt.sign(
      { id: user.Id, role: "USER" },
      "SECRET_KEY",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      user: {
        id: user.Id,
        username: user.Username,
        email: user.Email,
        fullname: user.Fullname,
        gender: user.Gender,
        birthday: user.Birthday,
        avatar: user.Avatar,
        phone: user.Phone,
        createAt: user.Create_at,
        updateAt: user.Update_at,
        token: token,
        loginType: user.LoginType
      }
    });

  } catch (error) {
    console.error("Development Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi: " + error.message
    });
  }
};