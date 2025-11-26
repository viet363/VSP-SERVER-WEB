import { db } from "../db.js";

export const getCustomers = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT Id, Username, Email, Fullname, Phone, Avatar, Create_at FROM User ORDER BY Id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[user]] = await db.query("SELECT * FROM User WHERE Id=?", [id]);
    // count orders
    const [[{ total_orders = 0 }]] = await db.query("SELECT COUNT(*) as total_orders FROM Orders WHERE UserId=?", [id]);
    res.json({ ...user, total_orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
