import { db } from "../../db.js";

export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu productId"
      });
    }

    const [reviews] = await db.query(`
      SELECT 
        pr.Id,
        pr.UserId,
        pr.ProductId,
        pr.OrderId,
        pr.Rating,
        pr.Title,
        pr.Content,
        pr.Create_at,
        pr.Update_at,
        u.Fullname AS userName,
        u.Avatar AS userAvatar
      FROM product_review pr
      LEFT JOIN user u ON u.Id = pr.UserId
      WHERE pr.ProductId = ?
      ORDER BY pr.Create_at DESC
    `, [productId]);

    const formattedReviews = reviews.map(review => ({
      id: review.Id,
      userId: review.UserId,
      productId: review.ProductId,
      orderId: review.OrderId,
      rating: review.Rating,
      title: review.Title,
      content: review.Content,
      createAt: review.Create_at,
      updateAt: review.Update_at,
      userName: review.userName,
      userAvatar: review.userAvatar
    }));

    res.json({
      success: true,
      data: formattedReviews
    });

  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy đánh giá"
    });
  }
};

export const getUserReviews = async (req, res) => {
  try {
    const userId = req.user?.Id;

    const [reviews] = await db.query(`
      SELECT 
        pr.Id,
        pr.UserId,
        pr.ProductId,
        pr.OrderId,
        pr.Rating,
        pr.Title,
        pr.Content,
        pr.Create_at,
        pr.Update_at,
        p.Product_name AS productName,
        p.picUrl AS productImage
      FROM product_review pr
      LEFT JOIN product p ON p.Id = pr.ProductId
      WHERE pr.UserId = ?
      ORDER BY pr.Create_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: reviews
    });

  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy đánh giá người dùng"
    });
  }
};

export const createReview = async (req, res) => {
  try {
    const userId = req.user?.Id;
    const { productId, rating, title, content, orderId } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({
        success: false,
        message: "Thiếu productId hoặc rating"
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating phải từ 1 đến 5 sao"
      });
    }

    // Kiểm tra sản phẩm tồn tại
    const [products] = await db.query(
      "SELECT Id FROM product WHERE Id = ? AND Product_status = 'Published'",
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Sản phẩm không tồn tại"
      });
    }

    // Kiểm tra nếu đã đánh giá (unique constraint)
    const [existingReviews] = await db.query(
      "SELECT Id FROM product_review WHERE UserId = ? AND ProductId = ?",
      [userId, productId]
    );

    if (existingReviews.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này rồi"
      });
    }

    // Kiểm tra orderId nếu có (xác nhận đã mua hàng)
    if (orderId) {
      const [orders] = await db.query(`
        SELECT od.Id 
        FROM order_detail od
        JOIN orders o ON o.Id = od.OrderId
        WHERE od.ProductId = ? AND o.UserId = ? AND od.OrderId = ?
        LIMIT 1
      `, [productId, userId, orderId]);

      if (orders.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Bạn chưa mua sản phẩm này hoặc order không hợp lệ"
        });
      }
    }

    // Tạo đánh giá
    const [result] = await db.query(`
      INSERT INTO product_review 
        (UserId, ProductId, OrderId, Rating, Title, Content) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, productId, orderId || null, rating, title || null, content || null]);

    // Lấy đánh giá vừa tạo
    const [newReview] = await db.query(`
      SELECT 
        pr.*,
        u.Fullname AS userName,
        u.Avatar AS userAvatar
      FROM product_review pr
      LEFT JOIN user u ON u.Id = pr.UserId
      WHERE pr.Id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: "Đánh giá thành công",
      data: newReview[0]
    });

  } catch (error) {
    console.error("Create review error:", error);
    
    // Xử lý unique constraint error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: "Bạn đã đánh giá sản phẩm này rồi"
      });
    }

    res.status(500).json({
      success: false,
      message: "Lỗi server khi tạo đánh giá"
    });
  }
};

// Cập nhật đánh giá
export const updateReview = async (req, res) => {
  try {
    const userId = req.user?.Id;
    const { reviewId } = req.params;
    const { rating, title, content } = req.body;

    const [reviews] = await db.query(
      "SELECT Id FROM product_review WHERE Id = ? AND UserId = ?",
      [reviewId, userId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá hoặc bạn không có quyền sửa"
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating phải từ 1 đến 5 sao"
        });
      }
      updateFields.push("Rating = ?");
      updateValues.push(rating);
    }

    if (title !== undefined) {
      updateFields.push("Title = ?");
      updateValues.push(title);
    }

    if (content !== undefined) {
      updateFields.push("Content = ?");
      updateValues.push(content);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Không có thông tin cần cập nhật"
      });
    }

    updateValues.push(reviewId);

    // Thực hiện update
    await db.query(
      `UPDATE product_review SET ${updateFields.join(", ")}, Update_at = CURRENT_TIMESTAMP WHERE Id = ?`,
      updateValues
    );

    // Lấy review đã cập nhật
    const [updatedReview] = await db.query(
      "SELECT * FROM product_review WHERE Id = ?",
      [reviewId]
    );

    res.json({
      success: true,
      message: "Cập nhật đánh giá thành công",
      data: updatedReview[0]
    });

  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi cập nhật đánh giá"
    });
  }
};

// Xóa đánh giá
export const deleteReview = async (req, res) => {
  try {
    const userId = req.user?.Id;
    const { reviewId } = req.params;

    // Kiểm tra review tồn tại và thuộc về user
    const [reviews] = await db.query(
      "SELECT Id FROM product_review WHERE Id = ? AND UserId = ?",
      [reviewId, userId]
    );

    if (reviews.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đánh giá hoặc bạn không có quyền xóa"
      });
    }

    // Xóa review
    await db.query("DELETE FROM product_review WHERE Id = ?", [reviewId]);

    res.json({
      success: true,
      message: "Xóa đánh giá thành công"
    });

  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi xóa đánh giá"
    });
  }
};

// Lấy thống kê rating của sản phẩm
export const getProductRatingStats = async (req, res) => {
  try {
    const { productId } = req.params;

    const [stats] = await db.query(`
      SELECT 
        COUNT(*) AS totalReviews,
        AVG(Rating) AS averageRating,
        SUM(CASE WHEN Rating = 5 THEN 1 ELSE 0 END) AS rating5,
        SUM(CASE WHEN Rating = 4 THEN 1 ELSE 0 END) AS rating4,
        SUM(CASE WHEN Rating = 3 THEN 1 ELSE 0 END) AS rating3,
        SUM(CASE WHEN Rating = 2 THEN 1 ELSE 0 END) AS rating2,
        SUM(CASE WHEN Rating = 1 THEN 1 ELSE 0 END) AS rating1
      FROM product_review 
      WHERE ProductId = ?
    `, [productId]);

    const result = stats[0];

    res.json({
      success: true,
      data: {
        totalReviews: result.totalReviews || 0,
        averageRating: parseFloat(result.averageRating || 0).toFixed(1),
        ratingDistribution: {
          5: result.rating5 || 0,
          4: result.rating4 || 0,
          3: result.rating3 || 0,
          2: result.rating2 || 0,
          1: result.rating1 || 0
        }
      }
    });

  } catch (error) {
    console.error("Get rating stats error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thống kê rating"
    });
  }
};