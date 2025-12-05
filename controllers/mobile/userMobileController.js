// controllers/mobile/userMobileController.js
import { db } from "../../db.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";

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
    const userId = req.user.Id; 
    const { fullname, email, phone } = req.body;

    // Kiểm tra email đã tồn tại chưa
    if (email) {
      const [existingUsers] = await db.query(
        "SELECT * FROM user WHERE Email = ? AND Id != ?",
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Email đã được sử dụng" 
        });
      }
    }

    await db.query(
      "UPDATE user SET Fullname = ?, Email = ?, Phone = ?, Update_at = CURRENT_TIMESTAMP WHERE Id = ?",
      [fullname, email, phone, userId]
    );

    const [updatedUsers] = await db.query(
      "SELECT Id, Username, Email, Fullname, Gender, Birthday, Avatar, Phone, Create_at, Update_at, LoginType FROM user WHERE Id = ?",
      [userId]
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
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn file ảnh"
      });
    }

    const userId = req.user.Id; 
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${avatarPath}`;

    console.log("Uploading avatar for user:", userId);
    console.log("Avatar saved at:", req.file.path);
    console.log("Avatar URL:", fullUrl);

    // Cập nhật database
    const [result] = await db.query(
      'UPDATE user SET Avatar = ?, Update_at = NOW() WHERE Id = ?',
      [fullUrl, userId]
    );

    if (result.affectedRows === 0) {
      // Xóa file đã upload nếu update thất bại
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại"
      });
    }

    // Lấy thông tin user mới
    const [users] = await db.query(
      "SELECT Id, Username, Email, Fullname, Gender, Birthday, Avatar, Phone, Create_at, Update_at, LoginType FROM user WHERE Id = ?",
      [userId]
    );

    res.json({
      success: true,
      message: "Cập nhật avatar thành công",
      avatarUrl: fullUrl,
      user: {
        id: users[0].Id,
        username: users[0].Username,
        email: users[0].Email,
        fullname: users[0].Fullname,
        gender: users[0].Gender,
        birthday: users[0].Birthday,
        avatar: users[0].Avatar,
        phone: users[0].Phone,
        createAt: users[0].Create_at,
        updateAt: users[0].Update_at,
        loginType: users[0].LoginType
      }
    });

  } catch (error) {
    console.error("Error uploading avatar:", error);
    
    // Xóa file nếu có lỗi
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error("Error deleting file:", e);
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Lỗi server khi upload avatar"
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