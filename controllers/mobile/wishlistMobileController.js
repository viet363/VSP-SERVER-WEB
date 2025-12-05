import { db } from "../../db.js";

export const getWishlistMobile = async (req, res) => {
  try {
    const userId = req.user.Id;

    const [data] = await db.query(
      `SELECT w.ProductId, w.Created_at, p.Product_name, p.Price, p.picUrl 
       FROM wishlist w
       JOIN product p ON p.Id = w.ProductId
       WHERE w.UserId = ? AND p.Product_status = 'Published'`,
      [userId]
    );

    res.json({ 
      success: true, 
      count: data.length,
      data 
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const addWishlistMobile = async (req, res) => {
  try {
    const userId = req.user.Id;
    const { productId } = req.body;

    // Kiểm tra sản phẩm có tồn tại không
    const [product] = await db.query(
      "SELECT Id FROM product WHERE Id = ? AND Product_status = 'Published'",
      [productId]
    );

    if (product.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Sản phẩm không tồn tại" 
      });
    }

    await db.query(
      "INSERT INTO wishlist (UserId, ProductId) VALUES (?,?) ON DUPLICATE KEY UPDATE ProductId = VALUES(ProductId)",
      [userId, productId]
    );

    res.json({ 
      success: true, 
      message: "Đã thêm vào danh sách yêu thích" 
    });

  } catch (error) {
    console.error("Add wishlist error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const deleteWishlistMobile = async (req, res) => {
  try {
    const userId = req.user.Id;
    const { productId } = req.params;

    await db.query(
      "DELETE FROM wishlist WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    res.json({ 
      success: true, 
      message: "Đã xóa khỏi danh sách yêu thích" 
    });

  } catch (error) {
    console.error("Delete wishlist error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};