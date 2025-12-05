import { db } from "../../db.js";
import unidecode from "unidecode";


export const getProductListMobile = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.Id,
        p.Product_name,          
        p.Description,
        p.Price,              
        p.picUrl,
        p.CategoryId,
        c.Category_name
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE (LOWER(p.Product_status) = 'published' OR p.Product_status IS NULL)
      ORDER BY p.Id DESC
    `);

    return res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (err) {
    console.error("getProductListMobile error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getProductDetailMobile = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(`
      SELECT 
        p.Id,
        p.Product_name,          
        p.Description,
        p.Price,               
        p.picUrl,
        p.CategoryId,
        c.Category_name
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE p.Id = ? AND (LOWER(p.Product_status) = 'published' OR p.Product_status IS NULL)

    `, [id]);

    if (!rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({ success: true, data: rows[0] });

  } catch (err) {
    console.error("getProductDetailMobile:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getProductSpecificationsMobile = async (req, res) => {
  try {
    const productId = req.params.id;

    const [rows] = await db.query(
      "SELECT id, ProductId, spec_key, spec_value FROM product_specification WHERE ProductId = ?",
      [productId]
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error fetching product specs" });
  }
};

export const searchProductsMobile = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Search query is required"
      });
    }

    // Chuẩn hóa từ khóa (không dấu)
    const searchTerm = query.trim();
    const searchNoAccent = unidecode(searchTerm.toLowerCase());
    const offset = (page - 1) * limit;

    // Kiểm tra FULLTEXT
    const [hasFulltext] = await db.query(`
      SELECT COUNT(*) as has_index
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'product' 
        AND INDEX_NAME = 'ft_product_name_desc'
        AND INDEX_TYPE = 'FULLTEXT'
    `);

    let sqlQuery;
    let countQuery;
    let params;
    let countParams;

    if (hasFulltext[0].has_index > 0) {
      // ==============================
      // 🔥 FULLTEXT MODE PRO
      // ==============================
      sqlQuery = `
        SELECT 
          p.Id,
          p.Product_name,
          p.Description,
          p.Price,
          p.picUrl,
          c.Category_name,
          MATCH(p.Product_name, p.Description) 
            AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance
        FROM product p
        LEFT JOIN category c ON p.CategoryId = c.Id
        WHERE (
          MATCH(p.Product_name, p.Description) AGAINST(? IN NATURAL LANGUAGE MODE)
          OR LOWER(p.Product_name) LIKE ?
          OR LOWER(p.Description) LIKE ?
          OR LOWER(c.Category_name) LIKE ?
        )
        AND (LOWER(p.Product_status) = 'published' OR p.Product_status IS NULL)
        ORDER BY relevance DESC, p.Id DESC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM product p
        LEFT JOIN category c ON p.CategoryId = c.Id
        WHERE (
          MATCH(p.Product_name, p.Description) AGAINST(? IN NATURAL LANGUAGE MODE)
          OR LOWER(p.Product_name) LIKE ?
          OR LOWER(p.Description) LIKE ?
          OR LOWER(c.Category_name) LIKE ?
        )
        AND (LOWER(p.Product_status) = 'published' OR p.Product_status IS NULL)
      `;

      params = [
        searchTerm,
        searchTerm,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        limit,
        offset
      ];

      countParams = [
        searchTerm,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`
      ];

    } else {
      // ==============================
      // 🔥 NON-FULLTEXT MODE PRO
      // ==============================
      sqlQuery = `
        SELECT 
          p.Id,
          p.Product_name,
          p.Description,
          p.Price,
          p.picUrl,
          c.Category_name,
          (
            (CASE WHEN LOWER(p.Product_name) LIKE ? THEN 3 ELSE 0 END) +
            (CASE WHEN LOWER(c.Category_name) LIKE ? THEN 2 ELSE 0 END) +
            (CASE WHEN LOWER(p.Description) LIKE ? THEN 1 ELSE 0 END)
          ) AS relevance
        FROM product p
        LEFT JOIN category c ON p.CategoryId = c.Id
        WHERE (
          LOWER(p.Product_name) LIKE ?
          OR LOWER(p.Description) LIKE ?
          OR LOWER(c.Category_name) LIKE ?
        )
        AND (LOWER(p.Product_status) = 'published' OR p.Product_status IS NULL)
        ORDER BY relevance DESC, p.Id DESC
        LIMIT ? OFFSET ?
      `;

      countQuery = `
        SELECT COUNT(*) AS total
        FROM product p
        LEFT JOIN category c ON p.CategoryId = c.Id
        WHERE (
          LOWER(p.Product_name) LIKE ?
          OR LOWER(p.Description) LIKE ?
          OR LOWER(c.Category_name) LIKE ?
        )
        AND (LOWER(p.Product_status) = 'published' OR p.Product_status IS NULL)
      `;

      params = [
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        limit,
        offset
      ];

      countParams = [
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`,
        `%${searchNoAccent}%`
      ];
    }

    const [rows] = await db.query(sqlQuery, params);
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    return res.json({
      success: true,
      total,
      count: rows.length,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      query: searchTerm,
      data: rows
    });

  } catch (err) {
    console.log("searchProductsMobile error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};