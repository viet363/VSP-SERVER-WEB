import { db } from '../../db.js';

// Kiểm tra và tạo bảng chat_message nếu chưa có
const checkChatTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_message (
        Id BIGINT PRIMARY KEY AUTO_INCREMENT,
        UserId BIGINT NOT NULL,
        AdminId BIGINT NOT NULL,
        SenderId BIGINT NOT NULL,
        Message TEXT,
        MessageType VARCHAR(20) DEFAULT 'text',
        IsRead TINYINT DEFAULT 0,
        ChatType VARCHAR(20) DEFAULT 'user_to_admin',
        Created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (UserId) REFERENCES user(Id) ON DELETE CASCADE,
        FOREIGN KEY (AdminId) REFERENCES user(Id) ON DELETE CASCADE,
        FOREIGN KEY (SenderId) REFERENCES user(Id) ON DELETE CASCADE,
        INDEX idx_user_admin (UserId, AdminId),
        INDEX idx_created (Created_at)
      )
    `);
    console.log('Chat table checked/created successfully');
  } catch (tableError) {
    console.error('Chat table error:', tableError.message);
  }
};

// Gọi hàm kiểm tra bảng khi khởi động
checkChatTable();

// GET: Lấy danh sách admin để chat
export const getChatWithFirstAdmin = async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`Getting chat messages for user: ${userId}`);
    
    const [admins] = await db.query(
      `SELECT u.Id, u.Username, u.Fullname, u.Avatar 
       FROM user u 
       JOIN user_role ur ON ur.UserId = u.Id
       JOIN role r ON r.Id = ur.RoleId
       WHERE r.Name = 'admin'
       ORDER BY u.Id ASC
       LIMIT 1`,
      []
    );
    
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin nào'
      });
    }
    
    const adminId = admins[0].Id;
    
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
        CASE 
          WHEN cm.SenderId = ? THEN 'user'
          ELSE 'admin'
        END as SenderType
       FROM chat_message cm
       WHERE (cm.UserId = ? AND cm.AdminId = ?)
          OR (cm.UserId = ? AND cm.SenderId = ?)
       ORDER BY cm.Created_at ASC`,
      [userId, userId, adminId, adminId, userId]
    );
    
    res.json({
      success: true,
      data: {
        admin: admins[0],
        messages: messages || []
      }
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tải tin nhắn'
    });
  }
};

// GET: Lấy tin nhắn với một admin cụ thể
export const getChatWithAdmin = async (req, res) => {
  try {
    const userId = req.userId;
    const adminId = req.params.adminId;
    
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
        CASE 
          WHEN cm.SenderId = ? THEN 'user'
          ELSE 'admin'
        END as SenderType
       FROM chat_message cm
       WHERE (cm.UserId = ? AND cm.AdminId = ?)
          OR (cm.UserId = ? AND cm.SenderId = ?)
       ORDER BY cm.Created_at ASC`,
      [userId, userId, adminId, adminId, userId]
    );
    
    // Đánh dấu tin nhắn chưa đọc là đã đọc
    if (messages && messages.length > 0) {
      const unreadMessages = messages.filter(m => !m.IsRead && m.SenderId != userId);
      if (unreadMessages.length > 0) {
        const unreadIds = unreadMessages.map(m => m.Id);
        await db.query(
          'UPDATE chat_message SET IsRead = 1 WHERE Id IN (?)',
          [unreadIds]
        );
      }
    }
    
    res.json({
      success: true,
      data: messages || []
    });
    
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tải tin nhắn'
    });
  }
};

// POST: Gửi tin nhắn
export const sendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { adminId, message, messageType = 'text' } = req.body;
    
    if (!adminId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc'
      });
    }
    
    const [result] = await db.query(
      `INSERT INTO chat_message 
       (UserId, AdminId, SenderId, Message, MessageType, IsRead, ChatType, Created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'user_to_admin', NOW())`,
      [userId, adminId, userId, message, messageType]
    );
    
    res.json({
      success: true,
      message: 'Tin nhắn đã gửi',
      messageId: result.insertId
    });
    
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi gửi tin nhắn'
    });
  }
};

// GET: Lấy danh sách admin
export const getAdminsList = async (req, res) => {
  try {
    const [admins] = await db.query(
      `SELECT DISTINCT 
        u.Id,
        u.Username,
        u.Fullname,
        u.Avatar,
        u.Email,
        u.Phone,
        (SELECT COUNT(*) 
         FROM chat_message cm 
         WHERE cm.UserId = ? 
           AND cm.AdminId = u.Id 
           AND cm.IsRead = 0 
           AND cm.SenderId != ?) as UnreadCount
       FROM user u 
       JOIN user_role ur ON ur.UserId = u.Id
       JOIN role r ON r.Id = ur.RoleId
       WHERE r.Name = 'admin'
       ORDER BY u.Id ASC`,
      [req.userId, req.userId]
    );
    
    res.json({
      success: true,
      data: admins || []
    });
    
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tải danh sách admin'
    });
  }
};

// GET: Lấy admin đầu tiên
export const getFirstAdmin = async (req, res) => {
  try {
    const [admins] = await db.query(
      `SELECT u.Id, u.Username, u.Fullname, u.Avatar 
       FROM user u 
       JOIN user_role ur ON ur.UserId = u.Id
       JOIN role r ON r.Id = ur.RoleId
       WHERE r.Name = 'admin'
       ORDER BY u.Id ASC
       LIMIT 1`,
      []
    );
    
    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy admin'
      });
    }
    
    res.json({
      success: true,
      data: admins[0]
    });
    
  } catch (error) {
    console.error('Get first admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
};

// GET: Lấy số tin nhắn chưa đọc
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;
    
    const [result] = await db.query(
      `SELECT COUNT(*) as unreadCount
       FROM chat_message cm
       JOIN user u ON u.Id = cm.AdminId
       JOIN user_role ur ON ur.UserId = u.Id
       JOIN role r ON r.Id = ur.RoleId
       WHERE cm.UserId = ? 
         AND cm.IsRead = 0 
         AND cm.SenderId != ?
         AND r.Name = 'admin'`,
      [userId, userId]
    );
    
    res.json({
      success: true,
      data: {
        unreadCount: result[0]?.unreadCount || 0
      }
    });
    
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server'
    });
  }
};
export const getUpdates = async (req, res) => {
  try {
    const userId = req.userId;
    const lastId = req.query.lastId || 0;

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
          CASE 
            WHEN cm.SenderId = ? THEN 'user'
            ELSE 'admin'
          END as SenderType
       FROM chat_message cm
       WHERE cm.Id > ?
         AND cm.UserId = ?
       ORDER BY cm.Id ASC`,
      [userId, lastId, userId]
    );

    return res.json({
      success: true,
      data: {
        messages
      }
    });

  } catch (err) {
    console.error("Get updates error:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server"
    });
  }
};
