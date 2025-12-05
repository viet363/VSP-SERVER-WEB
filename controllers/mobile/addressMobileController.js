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
  const { receiver_name, phone, address_detail, is_default = 0 } = req.body;

  await db.query(
    "INSERT INTO user_address (UserId, Receiver_name, Phone, Address_detail, Is_default) VALUES (?,?,?,?,?)",
    [userId, receiver_name, phone, address_detail, is_default]
  );

  res.json({ success: true });
};

export const deleteAddressMobile = async (req, res) => {
  const { id } = req.params;
  await db.query("DELETE FROM user_address WHERE Id = ?", [id]);
  res.json({ success: true });
};

export const updateAddressMobile = async (req, res) => {
  const { id } = req.params;
  const { receiver_name, phone, address_detail, is_default = 0 } = req.body;

  await db.query(
    "UPDATE user_address SET Receiver_name = ?, Phone = ?, Address_detail = ?, Is_default = ? WHERE Id = ?",
    [receiver_name, phone, address_detail, is_default, id]
  );

  res.json({ success: true });
};