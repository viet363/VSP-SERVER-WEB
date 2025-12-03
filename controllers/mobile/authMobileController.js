import { db } from "../../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client("YOUR_GOOGLE_CLIENT_ID");

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

export const mobileLoginWithGoogle = async (req, res) => {
  const { idToken } = req.body;

  try {
    if (!idToken) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu token Google" 
      });
    }

    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: "YOUR_GOOGLE_CLIENT_ID"
    });

    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: "Không thể lấy email từ Google" 
      });
    }

    // Tìm user bằng email
    const [users] = await db.query(
      "SELECT * FROM user WHERE Email = ?",
      [email]
    );
    let user = users[0];

    // Nếu user chưa tồn tại, tạo mới
    if (!user) {
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
      }

      const [result] = await db.query(
        "INSERT INTO user (Username, Email, Fullname, Avatar, GoogleId, LoginType) VALUES (?, ?, ?, ?, ?, ?)",
        [username, email, name, picture, googleId, 'google']
      );

      const [newUsers] = await db.query(
        "SELECT * FROM user WHERE Id = ?",
        [result.insertId]
      );
      user = newUsers[0];
    } else {
      // Nếu user tồn tại nhưng không phải đăng ký bằng Google
      if (user.LoginType !== 'google' && !user.GoogleId) {
        return res.status(400).json({ 
          success: false, 
          message: "Email này đã được đăng ký bằng username/password. Vui lòng đăng nhập bằng mật khẩu." 
        });
      }

      await db.query(
        "UPDATE user SET Fullname = ?, Avatar = ?, GoogleId = ?, LoginType = ? WHERE Id = ?",
        [name, picture, googleId, 'google', user.Id]
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
      loginType: user.LoginType
    });

  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi xác thực Google" 
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

    // Kiểm tra user đã tồn tại chưa
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