import { db } from '../db.js';

export const getChatUsers = async (req, res) => {
  try {
    // Lấy admin ID
    const [admin] = await db.query(
      `SELECT u.Id 
       FROM user u
       JOIN user_role ur ON u.Id = ur.UserId
       WHERE ur.RoleId = 1 
       LIMIT 1`
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy admin"
      });
    }

    const adminId = admin[0].Id;

    // Lấy danh sách user đã chat (cả user-to-admin và admin-to-user)
    const [users] = await db.query(
      `SELECT DISTINCT 
          u.Id,
          u.Username,
          u.Email,
          u.Fullname,
          u.Avatar,
          u.Phone,
          u.Create_at,
          -- Thời gian tin nhắn cuối cùng
          COALESCE(
            (SELECT MAX(cm.Created_at) 
             FROM chat_message cm 
             WHERE (cm.UserId = u.Id AND cm.AdminId = ? AND cm.ChatType IN ('user_to_admin', 'admin_to_user'))
                OR (cm.AdminId = u.Id AND cm.UserId = ? AND cm.ChatType IN ('user_to_admin', 'admin_to_user'))), 
            u.Create_at
          ) AS LastMessageTime,
          -- Số tin nhắn chưa đọc (gửi đến current user/admin)
          COALESCE(
            (SELECT COUNT(*) 
             FROM chat_message cm 
             WHERE ((cm.UserId = u.Id AND cm.AdminId = ?) OR (cm.AdminId = u.Id AND cm.UserId = ?))
               AND cm.IsRead = 0 
               AND cm.SenderId != ?), 
            0
          ) AS UnreadCount,
          -- Lấy tin nhắn cuối cùng
          (SELECT cm.Message 
           FROM chat_message cm 
           WHERE (cm.UserId = u.Id AND cm.AdminId = ? AND cm.ChatType IN ('user_to_admin', 'admin_to_user'))
              OR (cm.AdminId = u.Id AND cm.UserId = ? AND cm.ChatType IN ('user_to_admin', 'admin_to_user'))
           ORDER BY cm.Created_at DESC 
           LIMIT 1) AS LastMessage,
          -- Loại chat
          CASE 
            WHEN u.Id = ? THEN 'admin'
            ELSE 'user'
          END AS UserType
       FROM user u
       WHERE u.Id != ?
         AND EXISTS (
           SELECT 1 FROM chat_message cm 
           WHERE (cm.UserId = u.Id AND cm.AdminId = ? AND cm.ChatType IN ('user_to_admin', 'admin_to_user'))
              OR (cm.AdminId = u.Id AND cm.UserId = ? AND cm.ChatType IN ('user_to_admin', 'admin_to_user'))
         )
       ORDER BY LastMessageTime DESC`,
      [adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId, adminId]
    );

    return res.json({
      success: true,
      data: users,
      count: users.length,
      adminId
    });

  } catch (error) {
    console.error("Get users error details:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const getUserMessages = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "ID người dùng không hợp lệ"
      });
    }

    // Lấy admin ID
    const [admin] = await db.query(
      `SELECT u.Id 
       FROM user u
       JOIN user_role ur ON u.Id = ur.UserId
       WHERE ur.RoleId = 1 
       LIMIT 1`
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy admin"
      });
    }

    const adminId = admin[0].Id;

    // Lấy tin nhắn giữa user và admin
    const [messages] = await db.query(
      `SELECT 
          cm.Id,
          cm.UserId,
          cm.AdminId,
          cm.SenderId,
          cm.Message,
          cm.MessageType,
          cm.IsRead,
          cm.Created_at,
          cm.ChatType,
          u.Username AS SenderName,
          u.Fullname AS SenderFullname,
          u.Avatar AS SenderAvatar,
          CASE 
            WHEN cm.SenderId = ? THEN 'admin'
            ELSE 'user'
          END AS SenderRole
       FROM chat_message cm
       JOIN user u ON u.Id = cm.SenderId
       WHERE ((cm.UserId = ? AND cm.AdminId = ?) 
          OR (cm.UserId = ? AND cm.AdminId = ?))
         AND cm.ChatType IN ('user_to_admin', 'admin_to_user')
       ORDER BY cm.Created_at ASC`,
      [adminId, userId, adminId, adminId, userId]
    );

    // Đánh dấu tin nhắn chưa đọc là đã đọc (nếu current user là admin)
    if (req.user?.role === 'admin' || req.user?.id == adminId) {
      const unreadMessageIds = messages
        .filter(m => !m.IsRead && m.SenderId != adminId)
        .map(m => m.Id);

      if (unreadMessageIds.length > 0) {
        const placeholders = unreadMessageIds.map(() => '?').join(',');
        await db.query(
          `UPDATE chat_message SET IsRead = 1 WHERE Id IN (${placeholders})`,
          unreadMessageIds
        );
        
        // Cập nhật IsRead trong response
        messages.forEach(m => {
          if (unreadMessageIds.includes(m.Id)) {
            m.IsRead = 1;
          }
        });
      }
    }

    return res.json({
      success: true,
      data: messages,
      userId: parseInt(userId),
      adminId
    });

  } catch (error) {
    console.error("Get user messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const adminSendMessage = async (req, res) => {
  try {
    const { userId, message, messageType = "text" } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc"
      });
    }

    // Kiểm tra user tồn tại
    const [userCheck] = await db.query(
      `SELECT Id FROM user WHERE Id = ?`,
      [userId]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại"
      });
    }

    // Lấy admin ID từ authenticated user hoặc query
    let adminId;
    if (req.user?.role === 'admin') {
      adminId = req.user.id;
    } else {
      const [admin] = await db.query(
        `SELECT u.Id 
         FROM user u
         JOIN user_role ur ON u.Id = ur.UserId
         WHERE ur.RoleId = 1 
         LIMIT 1`
      );

      if (admin.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy admin"
        });
      }
      adminId = admin[0].Id;
    }

    // Insert tin nhắn - Sửa thứ tự columns cho đúng với DB schema
    const [result] = await db.query(
      `INSERT INTO chat_message
        (UserId, SenderId, Message, MessageType, IsRead, ChatType, Created_at, AdminId)
       VALUES (?, ?, ?, ?, 0, 'admin_to_user', NOW(), ?)`,
      [userId, adminId, message, messageType, adminId]
    );

    return res.json({
      success: true,
      message: "Tin nhắn đã gửi",
      data: {
        messageId: result.insertId,
        userId: parseInt(userId),
        adminId,
        senderId: adminId,
        message,
        messageType,
        chatType: 'admin_to_user',
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("Admin send message error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi tin nhắn",
      error: error.message
    });
  }
};

export const getAdminInfo = async (req, res) => {
  try {
    const [admin] = await db.query(
      `SELECT u.Id, u.Username, u.Fullname, u.Avatar, u.Email, u.Phone
       FROM user u
       JOIN user_role ur ON u.Id = ur.UserId
       WHERE ur.RoleId = 1 
       LIMIT 1`
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy admin"
      });
    }

    return res.json({
      success: true,
      data: admin[0]
    });

  } catch (error) {
    console.error("Get admin info error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const userSendMessage = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { message, messageType = "text" } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc"
      });
    }

    // Kiểm tra user tồn tại
    const [userCheck] = await db.query(
      `SELECT Id FROM user WHERE Id = ?`,
      [userId]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Người dùng không tồn tại"
      });
    }

    // Lấy admin ID
    const [admin] = await db.query(
      `SELECT u.Id 
       FROM user u
       JOIN user_role ur ON u.Id = ur.UserId
       WHERE ur.RoleId = 1 
       LIMIT 1`
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy admin"
      });
    }

    const adminId = admin[0].Id;

    // Insert tin nhắn - Sửa thứ tự columns cho đúng với DB schema
    const [result] = await db.query(
      `INSERT INTO chat_message
        (UserId, SenderId, Message, MessageType, IsRead, ChatType, Created_at, AdminId)
       VALUES (?, ?, ?, ?, 0, 'user_to_admin', NOW(), ?)`,
      [userId, userId, message, messageType, adminId]
    );

    return res.json({
      success: true,
      message: "Tin nhắn đã gửi",
      data: {
        messageId: result.insertId,
        userId: parseInt(userId),
        adminId,
        senderId: userId,
        message,
        messageType,
        chatType: 'user_to_admin',
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("User send message error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi tin nhắn",
      error: error.message
    });
  }
};

// Hàm mới: Lấy tin nhắn chưa đọc cho user
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.params.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu user ID"
      });
    }

    const [admin] = await db.query(
      `SELECT u.Id 
       FROM user u
       JOIN user_role ur ON u.Id = ur.UserId
       WHERE ur.RoleId = 1 
       LIMIT 1`
    );

    if (admin.length === 0) {
      return res.json({
        success: true,
        count: 0,
        adminId: null
      });
    }

    const adminId = admin[0].Id;

    // Đếm tin nhắn chưa đọc
    const [result] = await db.query(
      `SELECT COUNT(*) as unreadCount
       FROM chat_message
       WHERE ((UserId = ? AND AdminId = ?) OR (UserId = ? AND AdminId = ?))
         AND IsRead = 0 
         AND SenderId != ?`,
      [userId, adminId, adminId, userId, userId]
    );

    return res.json({
      success: true,
      count: result[0]?.unreadCount || 0,
      adminId
    });

  } catch (error) {
    console.error("Get unread count error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message
    });
  }
};

// Hàm mới: Đánh dấu tất cả tin nhắn là đã đọc
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { targetUserId } = req.body; // ID của user còn lại trong cuộc trò chuyện

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin user"
      });
    }

    // Xác định ai là admin
    const [admin] = await db.query(
      `SELECT u.Id 
       FROM user u
       JOIN user_role ur ON u.Id = ur.UserId
       WHERE ur.RoleId = 1 
       LIMIT 1`
    );

    if (admin.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy admin"
      });
    }

    const adminId = admin[0].Id;
    
    // Xác định UserId và AdminId cho query
    const queryUserId = userId == adminId ? targetUserId : userId;
    const queryAdminId = userId == adminId ? adminId : targetUserId;

    // Đánh dấu tất cả tin nhắn là đã đọc
    await db.query(
      `UPDATE chat_message 
       SET IsRead = 1 
       WHERE ((UserId = ? AND AdminId = ?) OR (UserId = ? AND AdminId = ?))
         AND IsRead = 0 
         AND SenderId != ?`,
      [queryUserId, queryAdminId, queryAdminId, queryUserId, userId]
    );

    return res.json({
      success: true,
      message: "Đã đánh dấu tất cả tin nhắn là đã đọc"
    });

  } catch (error) {
    console.error("Mark all as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message
    });
  }
};