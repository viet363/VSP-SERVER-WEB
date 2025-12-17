import { db } from "../../db.js";
import bcryptjs from "bcryptjs";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinaryUpload.js";

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
    
    const [users] = await db.query(
      "SELECT Avatar FROM user WHERE Id = ?",
      [userId]
    );
    
    const oldAvatarUrl = users[0]?.Avatar;

    const uploadResult = await uploadToCloudinary(req.file.buffer, userId);
    const cloudinaryUrl = uploadResult.secure_url;

    console.log("Uploading avatar for user:", userId);
    console.log("Cloudinary URL:", cloudinaryUrl);

    const [result] = await db.query(
      'UPDATE user SET Avatar = ?, Update_at = NOW() WHERE Id = ?',
      [cloudinaryUrl, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại"
      });
    }

    if (oldAvatarUrl && oldAvatarUrl.includes('cloudinary')) {
      await deleteFromCloudinary(oldAvatarUrl);
    }

    const [updatedUsers] = await db.query(
      "SELECT Id, Username, Email, Fullname, Gender, Birthday, Avatar, Phone, Create_at, Update_at, LoginType FROM user WHERE Id = ?",
      [userId]
    );

    res.json({
      success: true,
      message: "Cập nhật avatar thành công",
      avatarUrl: cloudinaryUrl,
      user: {
        id: updatedUsers[0].Id,
        username: updatedUsers[0].Username,
        email: updatedUsers[0].Email,
        fullname: updatedUsers[0].Fullname,
        gender: updatedUsers[0].Gender,
        birthday: updatedUsers[0].Birthday,
        avatar: updatedUsers[0].Avatar,
        phone: updatedUsers[0].Phone,
        createAt: updatedUsers[0].Create_at,
        updateAt: updatedUsers[0].Update_at,
        loginType: updatedUsers[0].LoginType
      }
    });

  } catch (error) {
    console.error("Error uploading avatar:", error);
    
    res.status(500).json({
      success: false,
      message: `Lỗi server khi upload avatar: ${error.message}`
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

    if (user.LoginType === 'google') {
      return res.status(400).json({ 
        success: false, 
        message: "Tài khoản Google không thể đổi mật khẩu" 
      });
    }

    const match = await bcryptjs.compare(currentPassword, user.Password);
    if (!match) {
      return res.status(400).json({ 
        success: false, 
        message: "Mật khẩu hiện tại không đúng" 
      });
    }

    // Hash mật khẩu mới
    const hash = await bcryptjs.hash(newPassword, 10);

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