import { db } from "../../db.js";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh!'), false);
    }
  }
});

export const getUserMobile = async (req, res) => {
  try {
    const userId = req.user.Id;
    
    const [users] = await db.query(
      "SELECT Id, Username, Email, Fullname, Gender, Birthday, Avatar, Phone, Create_at, Update_at, LoginType FROM user WHERE Id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "User không tồn tại" 
      });
    }

    const user = users[0];
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
        loginType: user.LoginType
      }
    });

  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { id, fullname, email, phone } = req.body;

    // Kiểm tra email đã tồn tại chưa (trừ user hiện tại)
    const [existingUsers] = await db.query(
      "SELECT * FROM user WHERE Email = ? AND Id != ?",
      [email, id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Email đã được sử dụng" 
      });
    }

    await db.query(
      "UPDATE user SET Fullname = ?, Email = ?, Phone = ?, Update_at = CURRENT_TIMESTAMP WHERE Id = ?",
      [fullname, email, phone, id]
    );

    // Lấy lại thông tin user sau khi update
    const [updatedUsers] = await db.query(
      "SELECT Id, Username, Email, Fullname, Gender, Birthday, Avatar, Phone, Create_at, Update_at, LoginType FROM user WHERE Id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const updateUserWithAvatar = async (req, res) => {
  try {
    const { id, fullname, email, phone } = req.body;
    const avatarPath = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    // Kiểm tra email đã tồn tại chưa
    const [existingUsers] = await db.query(
      "SELECT * FROM user WHERE Email = ? AND Id != ?",
      [email, id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Email đã được sử dụng" 
      });
    }

    let updateQuery = "UPDATE user SET Fullname = ?, Email = ?, Phone = ?, Update_at = CURRENT_TIMESTAMP";
    let queryParams = [fullname, email, phone];

    if (avatarPath) {
      updateQuery += ", Avatar = ?";
      queryParams.push(avatarPath);
    }

    updateQuery += " WHERE Id = ?";
    queryParams.push(id);

    await db.query(updateQuery, queryParams);

    // Lấy lại thông tin user sau khi update
    const [updatedUsers] = await db.query(
      "SELECT Id, Username, Email, Fullname, Gender, Birthday, Avatar, Phone, Create_at, Update_at, LoginType FROM user WHERE Id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Cập nhật thông tin thành công",
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error("Update profile with avatar error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { id, currentPassword, newPassword } = req.body;

    if (!id || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: "Vui lòng nhập đầy đủ thông tin" 
      });
    }

    // Lấy thông tin user
    const [users] = await db.query(
      "SELECT * FROM user WHERE Id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy người dùng" 
      });
    }

    const user = users[0];

    // Kiểm tra nếu user đăng nhập bằng Google
    if (user.LoginType === 'google') {
      return res.status(400).json({ 
        success: false, 
        message: "Tài khoản Google không thể đổi mật khẩu" 
      });
    }

    // Kiểm tra mật khẩu hiện tại
    const match = await bcrypt.compare(currentPassword, user.Password);
    if (!match) {
      return res.status(400).json({ 
        success: false, 
        message: "Mật khẩu hiện tại không đúng" 
      });
    }

    // Hash mật khẩu mới
    const hash = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE user SET Password = ?, Update_at = CURRENT_TIMESTAMP WHERE Id = ?",
      [hash, id]
    );

    res.json({
      success: true,
      message: "Đổi mật khẩu thành công"
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};