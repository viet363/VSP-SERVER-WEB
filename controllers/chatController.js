import { db } from '../db.js';

export const getChatUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT DISTINCT 
          u.Id,
          u.Username,
          u.Email,
          u.Fullname,
          u.Avatar,
          u.Phone,
          COALESCE(
            (SELECT MAX(Created_at) 
             FROM chat_message 
             WHERE UserId = u.Id), 
            u.Create_at
          ) AS LastMessageTime,
          COALESCE(
            (SELECT COUNT(*) 
             FROM chat_message 
             WHERE UserId = u.Id 
             AND IsRead = 0 AND SenderId = u.Id), 
            0
          ) AS UnreadCount
       FROM user u
       WHERE EXISTS (
         SELECT 1 FROM chat_message cm 
         WHERE cm.UserId = u.Id
       )
       ORDER BY LastMessageTime DESC`
    );

    console.log("Users found:", users.length);

    return res.json({
      success: true,
      data: users,
      count: users.length
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
       ORDER BY cm.Created_at ASC`,
      [userId]
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
      userId
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
    const { userId, message, messageType = "text" } = req.body;

    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc"
      });
    }

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

    const [admin] = await db.query(
      `SELECT Id FROM user WHERE Id IN (SELECT UserId FROM user_role WHERE RoleId = 1) LIMIT 1`
    );

    const adminId = admin.length > 0 ? admin[0].Id : 1;

    const [result] = await db.query(
      `INSERT INTO chat_message
        (UserId, AdminId, SenderId, Message, MessageType, IsRead, ChatType, Created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'admin_to_user', NOW())`,
      [userId, adminId, adminId, message, messageType]
    );

    return res.json({
      success: true,
      message: "Tin nhắn đã gửi",
      messageId: result.insertId,
      adminId
    });

  } catch (error) {
    console.error("Admin send message error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi gửi tin nhắn"
    });
  }
};