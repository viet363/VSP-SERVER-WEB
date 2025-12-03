import { db } from "../../db.js";

export const getCartMobile = async (req, res) => {
  const userId = req.params.userId;

  const [[cart]] = await db.query(
    "SELECT * FROM cart WHERE UserId = ?", [userId]
  );

  if (!cart) return res.json({ success: true, items: [] });

  const [items] = await db.query(`
    SELECT cd.Id, cd.Quantity, p.Id AS productId, p.Name AS productName,
           p.Price, p.Image
    FROM cart_detail cd
    JOIN product p ON p.Id = cd.ProductId
    WHERE cd.CartId = ?
  `, [cart.Id]);

  res.json({ success: true, items });
};


export const addToCartMobile = async (req, res) => {
  const { productId, quantity } = req.body;

  const [cart] = await db.query(
    "SELECT * FROM cart WHERE UserId = ?", [req.user.Id]
  );

  let cartId = cart[0]?.Id;

  if (!cartId) {
    const [result] = await db.query(
      "INSERT INTO cart (UserId) VALUES (?)", [req.user.Id]
    );
    cartId = result.insertId;
  }

  await db.query(`
    INSERT INTO cart_detail (CartId, ProductId, Quantity)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE Quantity = Quantity + ?
  `, [cartId, productId, quantity, quantity]);

  res.json({ success: true });
};


export const updateCartMobile = async (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;

  await db.query("UPDATE cart_detail SET Quantity = ? WHERE Id = ?", [
    quantity,
    id,
  ]);

  res.json({ success: true });
};


export const deleteCartItemMobile = async (req, res) => {
  const { id } = req.params;

  await db.query("DELETE FROM cart_detail WHERE Id = ?", [id]);

  res.json({ success: true });
};


