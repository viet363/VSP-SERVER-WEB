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
    const { Category_name, Description, picUrl } = req.body;
    console.log('Creating category:', { Category_name, Description, picUrl });
    
    const [result] = await db.query(
      "INSERT INTO category (Category_name, Description, picUrl) VALUES (?, ?, ?)", 
      [Category_name, Description || null, picUrl || null]
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
    const { Category_name, Description, picUrl } = req.body;
    console.log('Updating category:', id, { Category_name, Description, picUrl });
    
    await db.query(
      "UPDATE category SET Category_name=?, Description=?, picUrl=?, Update_at=NOW() WHERE Id=?", 
      [Category_name, Description, picUrl, id]
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