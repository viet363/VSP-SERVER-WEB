import { db } from "../../db.js";

export const getCartMobile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.Id;

    const [[cart]] = await db.query(
      "SELECT * FROM cart WHERE UserId = ?", [userId]
    );

    if (!cart) return res.json({ success: true, items: [] });

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
      "SELECT Price FROM product WHERE Id = ? AND Product_status = 'Published'", 
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Sản phẩm không tồn tại" 
      });
    }

    const unitPrice = products[0].Price;

    // Thêm vào cart_detail
    await db.query(`
      INSERT INTO cart_detail (CartId, ProductId, Quantity, Unit_price)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE Quantity = Quantity + ?, Unit_price = ?
    `, [cartId, productId, quantity, unitPrice, quantity, unitPrice]);

    res.json({ 
      success: true, 
      message: "Thêm vào giỏ hàng thành công" 
    });

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const updateCartMobile = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Số lượng phải lớn hơn 0" 
      });
    }

    await db.query("UPDATE cart_detail SET Quantity = ? WHERE Id = ?", [
      quantity, id
    ]);

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