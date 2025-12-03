import { db } from "../../db.js";

export const getWishlistMobile = async (req, res) => {
  const userId = req.user.Id;

  const [data] = await db.query(
    `SELECT w.ProductId, p.Name, p.Price, p.Image 
     FROM wishlist w
     JOIN product p ON p.Id = w.ProductId
     WHERE w.UserId = ?`,
    [userId]
  );

  res.json({ success: true, data });
};

export const addWishlistMobile = async (req, res) => {
  const userId = req.user.Id;
  const { productId } = req.body;

  await db.query(
    "INSERT INTO wishlist (UserId, ProductId) VALUES (?,?) ON DUPLICATE KEY UPDATE ProductId = ProductId",
    [userId, productId]
  );

  res.json({ success: true });
};

export const deleteWishlistMobile = async (req, res) => {
  const userId = req.user.Id;
  const { productId } = req.params;

  await db.query(
    "DELETE FROM wishlist WHERE UserId = ? AND ProductId = ?",
    [userId, productId]
  );

  res.json({ success: true });
};
