import { db } from "../../db.js";

export const getNotificationsMobile = async (req, res) => {
  try {
    const userId = req.query.userId;

    const [rows] = await db.query(
      `SELECT Id, Title, Message, Is_read, Created_at
       FROM notification
       WHERE UserId = ?
       ORDER BY Id DESC
       LIMIT 20`,
      [userId]
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};
