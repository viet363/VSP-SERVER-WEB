import { db } from "../../db.js";

export const getRecommendedProducts = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.Id;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing userId",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        p.Id,
        p.Product_name,
        p.Description,
        p.Price,
        p.picUrl,
        ur.Score
      FROM user_recommendation ur
      JOIN product p ON ur.ProductId = p.Id
      WHERE ur.UserId = ?
        AND ur.Algorithm = 'ncf'
        AND p.Product_status = 'Published'
      ORDER BY ur.Score DESC
      LIMIT 10
      `,
      [userId]
    );

    const formattedData = rows.map((item) => ({
      Id: item.Id,
      Product_name: item.Product_name,
      Description: item.Description,
      Price: parseFloat(item.Price),
      picUrl: item.picUrl,
      Score: item.Score,
    }));

    return res.json({
      success: true,
      count: formattedData.length,
      data: formattedData,
    });
  } catch (err) {
    console.error("getRecommendedProducts error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};