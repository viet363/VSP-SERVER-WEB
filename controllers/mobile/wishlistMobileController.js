import { db } from "../../db.js";

// Thêm vào wishlist
export const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Kiểm tra sản phẩm tồn tại
    const [productCheck] = await db.query(
      "SELECT Id FROM product WHERE Id = ? AND (LOWER(Product_status) = 'published' OR Product_status IS NULL)",
      [productId]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại hoặc đã bị xóa"
      });
    }

    // Kiểm tra đã có trong wishlist chưa
    const [existing] = await db.query(
      "SELECT Id FROM wishlist WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm đã có trong danh sách yêu thích"
      });
    }

    // Thêm vào wishlist
    await db.query(
      "INSERT INTO wishlist (UserId, ProductId, Created_at) VALUES (?, ?, NOW())",
      [userId, productId]
    );

    res.json({
      success: true,
      message: "Đã thêm vào danh sách yêu thích"
    });

  } catch (err) {
    console.error("addToWishlist error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Xóa khỏi wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const [result] = await db.query(
      "DELETE FROM wishlist WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không có trong danh sách yêu thích"
      });
    }

    res.json({
      success: true,
      message: "Đã xóa khỏi danh sách yêu thích"
    });

  } catch (err) {
    console.error("removeFromWishlist error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Lấy danh sách wishlist của user
export const getUserWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT 
        w.Id,
        w.ProductId,
        w.Created_at,
        p.Product_name as title,
        p.Description,
        p.Price,
        p.picUrl,
        c.Category_name
      FROM wishlist w
      LEFT JOIN product p ON w.ProductId = p.Id
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE w.UserId = ?
      ORDER BY w.Created_at DESC
    `, [userId]);

    // Parse picUrl từ JSON string nếu cần
    const wishlistItems = rows.map(item => {
      let picUrl = [];
      try {
        if (item.picUrl) {
          if (typeof item.picUrl === 'string') {
            picUrl = JSON.parse(item.picUrl);
          } else if (Array.isArray(item.picUrl)) {
            picUrl = item.picUrl;
          }
        }
      } catch (e) {
        console.error("Error parsing picUrl:", e);
      }

      return {
        ...item,
        picUrl
      };
    });

    res.json({
      success: true,
      data: wishlistItems
    });

  } catch (err) {
    console.error("getUserWishlist error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Kiểm tra sản phẩm có trong wishlist không
export const checkWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    const [rows] = await db.query(
      "SELECT Id FROM wishlist WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    res.json({
      success: true,
      inWishlist: rows.length > 0
    });

  } catch (err) {
    console.error("checkWishlist error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};