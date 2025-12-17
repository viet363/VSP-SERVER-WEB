import { db } from "../../db.js";

export const addToWishlist = async (req, res) => {
  try {
    console.log("=== ADD TO WISHLIST DEBUG ===");
    const { productId } = req.params;
    
    const userId = req.user?.id || req.userId;
    
    console.log("ProductId from params:", productId);
    console.log("UserId from req.user.id:", req.user?.id);
    console.log("UserId from req.userId:", req.userId);
    console.log("Using userId:", userId);
    console.log("req.user object:", req.user);
    console.log("req.userId:", req.userId);

    if (!userId) {
      console.log("ERROR: UserId is null or undefined!");
      return res.status(401).json({
        success: false,
        message: "Không tìm thấy thông tin người dùng"
      });
    }

    // Kiểm tra productId có hợp lệ không
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: "Product ID không hợp lệ"
      });
    }

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

    console.log("Existing wishlist entries:", existing.length);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm đã có trong danh sách yêu thích"
      });
    }

    // Thêm vào wishlist
    console.log("Inserting into wishlist - UserId:", userId, "ProductId:", productId);
    await db.query(
      "INSERT INTO wishlist (UserId, ProductId, Created_at) VALUES (?, ?, NOW())",
      [userId, productId]
    );

    console.log("=== ADD TO WISHLIST SUCCESS ===");
    res.json({
      success: true,
      message: "Đã thêm vào danh sách yêu thích"
    });

  } catch (err) {
    console.error("addToWishlist error:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      sql: err.sql,
      sqlMessage: err.sqlMessage
    });
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// Xóa khỏi wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    console.log("=== REMOVE FROM WISHLIST DEBUG ===");
    const { productId } = req.params;
    
    // Lấy userId từ cả 2 cách
    const userId = req.user?.id || req.userId;
    
    console.log("ProductId:", productId);
    console.log("UserId:", userId);

    // Kiểm tra productId có hợp lệ không
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: "Product ID không hợp lệ"
      });
    }

    const [result] = await db.query(
      "DELETE FROM wishlist WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    console.log("Rows affected:", result.affectedRows);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không có trong danh sách yêu thích"
      });
    }

    console.log("=== REMOVE FROM WISHLIST SUCCESS ===");
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

export const getUserWishlist = async (req, res) => {
  try {
    console.log("=== GET USER WISHLIST DEBUG ===");
    
    // Lấy userId từ cả 2 cách
    const userId = req.user?.id || req.userId;
    
    console.log("UserId:", userId);

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

    console.log("Found wishlist items:", rows.length);

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
    console.log("=== CHECK WISHLIST DEBUG ===");
    const { productId } = req.params;
    
    // Lấy userId từ cả 2 cách
    const userId = req.user?.id || req.userId;
    
    console.log("ProductId:", productId);
    console.log("UserId:", userId);

    // Kiểm tra productId có hợp lệ không
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: "Product ID không hợp lệ"
      });
    }

    const [rows] = await db.query(
      "SELECT Id FROM wishlist WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    const inWishlist = rows.length > 0;
    console.log("Product in wishlist:", inWishlist);

    res.json({
      success: true,
      data: {
        inWishlist: inWishlist
      }
    });

  } catch (err) {
    console.error("checkWishlist error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};