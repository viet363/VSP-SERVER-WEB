import { db } from "../../db.js";

export const getCartMobile = async (req, res) => {
  try {
    const userId = req.user.Id;

    const [[cart]] = await db.query(
      "SELECT * FROM cart WHERE UserId = ?", [userId]
    );

    if (!cart) {
      const [result] = await db.query(
        "INSERT INTO cart (UserId) VALUES (?)", [userId]
      );
      
      return res.json({ 
        success: true, 
        cartId: result.insertId,
        items: [] 
      });
    }

    const [items] = await db.query(`
      SELECT cd.Id, cd.Quantity, p.Id AS productId, p.Product_name AS productName,
             p.Price, p.picUrl AS productImage
      FROM cart_detail cd
      JOIN product p ON p.Id = cd.ProductId
      WHERE cd.CartId = ?
    `, [cart.Id]);

    res.json({ 
      success: true, 
      cartId: cart.Id,
      items 
    });

  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const addToCartMobile = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.Id;

    if (!productId) {
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu productId" 
      });
    }

    // Tìm hoặc tạo cart
    const [carts] = await db.query(
      "SELECT Id FROM cart WHERE UserId = ?", [userId]
    );

    let cartId = carts[0]?.Id;

    if (!cartId) {
      const [result] = await db.query(
        "INSERT INTO cart (UserId) VALUES (?)", [userId]
      );
      cartId = result.insertId;
    }

    // Lấy giá sản phẩm
    const [products] = await db.query(
      "SELECT Id, Price, Product_name, picUrl FROM product WHERE Id = ? AND Product_status = 'Published'", 
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Sản phẩm không tồn tại" 
      });
    }

    const product = products[0];
    const unitPrice = product.Price;

    // Thêm vào cart_detail
    await db.query(`
      INSERT INTO cart_detail (CartId, ProductId, Quantity, Unit_price)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE Quantity = Quantity + ?, Update_at = NOW()
    `, [cartId, productId, quantity, unitPrice, quantity]);

    res.json({ 
      success: true, 
      message: "Thêm vào giỏ hàng thành công",
      cartItem: {
        id: productId,
        name: product.Product_name,
        price: unitPrice,
        image: product.picUrl,
        quantity: quantity
      }
    });

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server: " + error.message 
    });
  }
};

export const updateCartMobile = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.Id;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Số lượng phải lớn hơn 0" 
      });
    }

    const [cartItems] = await db.query(`
      SELECT cd.Id 
      FROM cart_detail cd
      JOIN cart c ON c.Id = cd.CartId
      WHERE cd.Id = ? AND c.UserId = ?
    `, [id, userId]);

    if (cartItems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy sản phẩm trong giỏ hàng" 
      });
    }

    await db.query(
      "UPDATE cart_detail SET Quantity = ?, Update_at = NOW() WHERE Id = ?", 
      [quantity, id]
    );

    res.json({ 
      success: true, 
      message: "Cập nhật giỏ hàng thành công" 
    });

  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const deleteCartItemMobile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.Id;

    const [cartItems] = await db.query(`
      SELECT cd.Id 
      FROM cart_detail cd
      JOIN cart c ON c.Id = cd.CartId
      WHERE cd.Id = ? AND c.UserId = ?
    `, [id, userId]);

    if (cartItems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy sản phẩm trong giỏ hàng" 
      });
    }

    await db.query("DELETE FROM cart_detail WHERE Id = ?", [id]);

    res.json({ 
      success: true, 
      message: "Xóa sản phẩm khỏi giỏ hàng thành công" 
    });

  } catch (error) {
    console.error("Delete cart item error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const clearCartMobile = async (req, res) => {
  try {
    const userId = req.user.Id;

    // Tìm cart của user
    const [carts] = await db.query(
      "SELECT Id FROM cart WHERE UserId = ?", [userId]
    );

    if (carts.length === 0) {
      return res.json({ 
        success: true, 
        message: "Giỏ hàng đã trống" 
      });
    }

    const cartId = carts[0].Id;

    // Xóa tất cả items trong cart
    await db.query("DELETE FROM cart_detail WHERE CartId = ?", [cartId]);

    res.json({ 
      success: true, 
      message: "Đã xóa tất cả sản phẩm trong giỏ hàng" 
    });

  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};