import { db } from "../../db.js";

export const getNotificationMobile = async (req, res) => {
  const userId = req.user.Id;
  const [rows] = await db.query(
    "SELECT * FROM notification WHERE UserId = ? ORDER BY Id DESC",
    [userId]
  );
  res.json({ success: true, data: rows });
};
