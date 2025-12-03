import { db } from "../../db.js";

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
        p.Price,
        p.picUrl,
        p.CategoryId,
        c.Category_name
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE p.Id = ?
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

    res.json(rows);
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

    const searchTerm = query.trim();
    const offset = (page - 1) * limit;

    const [rows] = await db.query(`
      SELECT 
        p.Id,
        p.Product_name,
        p.Description,
        p.Price,
        p.picUrl,
        p.CategoryId,
        c.Category_name,
        MATCH(p.Product_name, p.Description) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE 
        (MATCH(p.Product_name, p.Description) AGAINST(? IN NATURAL LANGUAGE MODE)
        OR c.Category_name LIKE ?)
        AND p.Product_status = 'Published'
      ORDER BY relevance DESC, p.Id DESC
      LIMIT ? OFFSET ?
    `, [searchTerm, searchTerm, `%${searchTerm}%`, parseInt(limit), offset]);

    const [countRows] = await db.query(`
      SELECT COUNT(*) as total
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE 
        (MATCH(p.Product_name, p.Description) AGAINST(? IN NATURAL LANGUAGE MODE)
        OR c.Category_name LIKE ?)
        AND p.Product_status = 'Published'
    `, [searchTerm, `%${searchTerm}%`]);

    const total = countRows[0].total;

    return res.json({
      success: true,
      count: rows.length,
      total: total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
      query: query,
      data: rows
    });

  } catch (err) {
    console.error("searchProductsMobile error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
