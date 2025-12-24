import { db } from "../db.js";

export const createPromotion = async (req, res) => {
  const { ProductId, Discount_amount, Start_date, End_date, Is_active } = req.body;

  if (!ProductId || !Discount_amount || !Start_date || !End_date) {
    return res.status(400).json({ 
      message: "Thiếu thông tin bắt buộc" 
    });
  }

  if (new Date(Start_date) >= new Date(End_date)) {
    return res.status(400).json({ 
      message: "Ngày kết thúc phải sau ngày bắt đầu" 
    });
  }

  if (Discount_amount <= 0) {
    return res.status(400).json({ 
      message: "Số tiền giảm giá phải lớn hơn 0" 
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [[product]] = await connection.query(
      "SELECT Id, Product_name FROM product WHERE Id = ?",
      [ProductId]
    );

    if (!product) {
      await connection.rollback();
      return res.status(404).json({ 
        message: "Sản phẩm không tồn tại" 
      });
    }

    const [existingPromotions] = await connection.query(
      `SELECT Id FROM product_discount 
       WHERE ProductId = ? 
       AND (
         (Start_date BETWEEN ? AND ?) OR 
         (End_date BETWEEN ? AND ?) OR
         (? BETWEEN Start_date AND End_date) OR
         (? BETWEEN Start_date AND End_date)
       ) AND Is_active = 1`,
      [ProductId, Start_date, End_date, Start_date, End_date, Start_date, End_date]
    );

    if (existingPromotions.length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        message: "Đã tồn tại khuyến mãi trong khoảng thời gian này" 
      });
    }

    await connection.query(
      `INSERT INTO product_discount 
       (ProductId, Discount_amount, Start_date, End_date, Is_active, Created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [ProductId, Discount_amount, Start_date, End_date, Is_active || 1]
    );

    const [users] = await connection.query(
      "SELECT Id FROM user LIMIT 1000"
    );

    if (users.length > 0) {
      const notificationValues = users.map(user => [
        user.Id,
        "Khuyến mãi mới",
        `Sản phẩm ${product.Product_name} đang được giảm ${Discount_amount} VNĐ! Xem ngay!`,
        'PROMOTION',
        ProductId
      ]);

      await connection.query(
        `INSERT INTO notification (UserId, Title, Message, Type, ReferenceId, Created_at)
         VALUES ?`,
        [notificationValues]
      );
    }

    await connection.query(
      `INSERT INTO notification (UserId, Title, Message, Type, ReferenceId, Created_at)
       VALUES (NULL, ?, ?, 'PROMOTION', ?, NOW())`,
      [
        "Khuyến mãi mới",
        `${product.Product_name} đang được giảm ${Discount_amount} VNĐ`,
        ProductId
      ]
    );

    await connection.commit();

    res.status(201).json({ 
      success: true,
      message: "Thêm khuyến mãi thành công!" 
    });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error("Error adding promotion:", err);
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ 
        message: "Khuyến mãi đã tồn tại" 
      });
    }
    
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(404).json({ 
        message: "Sản phẩm không tồn tại" 
      });
    }
    
    res.status(500).json({ 
      message: "Lỗi server",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};