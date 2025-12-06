import { db } from '../db.js';

export const getChatUsers = async (req, res) => {
  try {
    const adminId = req.adminId;

    const [users] = await db.query(
      `SELECT 
          u.Id,
          u.Username,
          u.Email,
          u.Fullname,
          u.Avatar,
          u.Phone,
          MAX(cm.Created_at) AS LastMessageTime,
          SUM(CASE WHEN cm.IsRead = 0 AND cm.SenderId = u.Id THEN 1 ELSE 0 END) AS UnreadCount
       FROM chat_message cm
       JOIN user u ON cm.UserId = u.Id
       WHERE cm.AdminId = ?
       GROUP BY u.Id
       ORDER BY LastMessageTime DESC`,
      [adminId]
    );

    return res.json({
      success: true,
      data: users,
      adminId
    });

  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server"
    });
  }
};


export const getUserMessages = async (req, res) => {
  try {
    const userId = req.params.userId;
    const adminId = req.adminId;

    const [messages] = await db.query(
      `SELECT 
          cm.Id,
          cm.UserId,
          cm.SenderId,
          cm.Message,
          cm.MessageType,
          cm.IsRead,
          cm.Created_at,
          cm.ChatType,
          u.Username AS SenderName,
          u.Fullname AS SenderFullname,
          u.Avatar AS SenderAvatar
       FROM chat_message cm
       JOIN user u ON u.Id = cm.SenderId
       WHERE cm.UserId = ?
         AND cm.AdminId = ?
       ORDER BY cm.Created_at ASC`,
      [userId, adminId]
    );

    const unreadFromUser = messages.filter(
      m => !m.IsRead && m.SenderId == userId
    );

    if (unreadFromUser.length > 0) {
      const unreadIds = unreadFromUser.map(m => m.Id);

      await db.query(
        `UPDATE chat_message SET IsRead = 1 WHERE Id IN (?)`,
        [unreadIds]
      );
    }

    return res.json({
      success: true,
      data: messages,
      userId,
      adminId
    });

  } catch (error) {
    console.error("Get user messages error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server"
    });
  }
};


export const adminSendMessage = async (req, res) => {
  try {
    const adminId = req.adminId;
    const { userId, message, messageType = "text" } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc"
      });
    }

    // Kiểm tra user có tồn tại
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

    // Gửi tin nhắn
    const [result] = await db.query(
      `INSERT INTO chat_message
        (UserId, AdminId, SenderId, Message, MessageType, IsRead, ChatType, Created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'admin_to_user', NOW())`,
      [userId, adminId, adminId, message, messageType]
    );

    return res.json({
      success: true,
      message: "Tin nhắn đã gửi",
      messageId: result.insertId
    });

  } catch (error) {
    console.error("Admin send message error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi tin nhắn"
    });
  }
};
