import { db } from "../db.js";

export const getProducts = async (req, res) => {
  try {
    console.log('Fetching products with category...');
    
    const [rows] = await db.query(`
      SELECT 
        p.Id, 
        p.Product_name, 
        p.model, 
        p.Description, 
        p.Standard_cost, 
        p.Price, 
        p.Product_status, 
        p.picUrl,
        p.Create_at,
        p.Update_at,
        p.CategoryId,
        c.Category_name
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      ORDER BY p.Product_name
    `);
    
    console.log('Products found:', rows.length);
    console.log('Sample product:', rows[0]); 
    res.json(rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.Id, 
        p.Product_name, 
        p.model, 
        p.Description, 
        p.Standard_cost, 
        p.Price, 
        p.Product_status, 
        p.picUrl,
        p.Create_at,
        p.Update_at,
        p.CategoryId,
        c.Category_name
      FROM product p
      LEFT JOIN category c ON p.CategoryId = c.Id
      WHERE p.Id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Get product by ID error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const { Product_name, model, Description, Standard_cost, Price, Product_status, picUrl, CategoryId } = req.body;
    
    console.log('Creating product:', { Product_name, Price, Product_status, CategoryId });
    
    const [result] = await db.query(
      "INSERT INTO product (Product_name, model, Description, Standard_cost, Price, Product_status, picUrl, CategoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [Product_name, model, Description, Standard_cost, Price, Product_status, picUrl, CategoryId || null]
    );
    
    res.json({ id: result.insertId, message: "Product created" });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { Product_name, model, Description, Standard_cost, Price, Product_status, picUrl, CategoryId } = req.body;
    
    console.log('Updating product:', id, { Product_name, Price, Product_status, CategoryId });
    
    await db.query(
      "UPDATE product SET Product_name = ?, model = ?, Description = ?, Standard_cost = ?, Price = ?, Product_status = ?, picUrl = ?, CategoryId = ? WHERE Id = ?",
      [Product_name, model, Description, Standard_cost, Price, Product_status, picUrl, CategoryId || null, id]
    );
    
    res.json({ message: "Product updated" });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting product:', id);
    
    await db.query("DELETE FROM product WHERE Id = ?", [id]);
    res.json({ message: "Product deleted" });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};