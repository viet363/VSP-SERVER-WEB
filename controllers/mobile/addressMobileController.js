import { db } from "../../db.js";

export const getAddressMobile = async (req, res) => {
  const userId = req.user.Id;
  const [rows] = await db.query(
    "SELECT * FROM user_address WHERE UserId = ?",
    [userId]
  );
  res.json({ success: true, data: rows });
};

export const addAddressMobile = async (req, res) => {
  const userId = req.user.Id;
  const { fullname, phone, address } = req.body;

  await db.query(
    "INSERT INTO user_address (UserId, FullName, Phone, Address) VALUES (?,?,?,?)",
    [userId, fullname, phone, address]
  );

  res.json({ success: true });
};

export const deleteAddressMobile = async (req, res) => {
  const { id } = req.params;
  await db.query("DELETE FROM user_address WHERE Id = ?", [id]);
  res.json({ success: true });
};
