import { db } from "../db.js";

export const getSpecByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const [rows] = await db.query(
      `SELECT Id, Spec_name 
       FROM specification
       WHERE CategoryId = ?`,
      [categoryId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Get spec by category error:", err);
    res.status(500).json({ error: err.message });
  }
};
export const getSpecByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const [rows] = await db.query(
      `SELECT Id, Spec_key, Spec_value 
       FROM product_specification
       WHERE ProductId = ?`,
      [productId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Get spec by product error:", err);
    res.status(500).json({ error: err.message });
  }
};
export const saveProductSpecs = async (req, res) => {
  try {
    const { productId } = req.params;
    const { specs } = req.body; 

    await db.query(
      "DELETE FROM product_specification WHERE ProductId = ?",
      [productId]
    );

    for (const s of specs) {
      await db.query(
        `INSERT INTO product_specification (ProductId, Spec_key, Spec_value)
         VALUES (?, ?, ?)`,
        [productId, s.key, s.value]
      );
    }

    res.json({ message: "Product specifications updated" });
  } catch (err) {
    console.error("Save specs error:", err);
    res.status(500).json({ error: err.message });
  }
};

