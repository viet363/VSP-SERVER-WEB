import { db } from "../db.js";

export const getCategories = async (req, res) => {
  try {
    console.log('Fetching categories...');
    const [rows] = await db.query("SELECT * FROM category ORDER BY Id");
    console.log('Categories found:', rows.length);
    res.json(rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { Category_name, picUrl } = req.body;
    console.log('Creating category:', { Category_name, picUrl });
    
    const [result] = await db.query(
      "INSERT INTO category (Category_name, picUrl) VALUES (?, ?)", 
      [Category_name, picUrl || null]
    );
    
    const [rows] = await db.query("SELECT * FROM category WHERE Id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { Category_name, picUrl } = req.body;
    console.log('Updating category:', id, { Category_name, picUrl });
    
    await db.query(
      "UPDATE category SET Category_name=?, picUrl=?, Update_at=NOW() WHERE Id=?", 
      [Category_name, picUrl || null, id]
    );
    
    const [rows] = await db.query("SELECT * FROM category WHERE Id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update category error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting category:', id);
    
    await db.query("DELETE FROM category WHERE Id = ?", [id]);
    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};
export const searchCategoriesAdvanced = async (req, res) => {
  try {
    const { keyword, sortBy = 'Id', sortOrder = 'ASC', page = 1, limit = 10 } = req.query;
    console.log('Advanced search:', { keyword, sortBy, sortOrder, page, limit });
    
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let queryParams = [];
    
    if (keyword && keyword.trim() !== '') {
      whereClause = "WHERE LOWER(Category_name) LIKE LOWER(?)";
      queryParams.push(`%${keyword}%`);
    }
    
    const [rows] = await db.query(
      `SELECT * FROM category 
       ${whereClause} 
       ORDER BY ${sortBy} ${sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), parseInt(offset)]
    );
    
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM category ${whereClause}`,
      queryParams
    );
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      categories: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
    
  } catch (err) {
    console.error('Advanced search error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};