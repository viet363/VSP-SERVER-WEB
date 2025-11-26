import { db } from "../db.js";

export const getWarehouses = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM Warehouse ORDER BY Id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const createWarehouse = async (req, res) => {
  try {
    const { UserId, Warehouse_name, Description, Image, Location } = req.body;
    const [result] = await db.query("INSERT INTO Warehouse (UserId, Warehouse_name, Description, Image, Location) VALUES (?, ?, ?, ?, ?)", [UserId, Warehouse_name, Description, Image, Location]);
    const [[w]] = await db.query("SELECT * FROM Warehouse WHERE Id=?", [result.insertId]);
    res.status(201).json(w);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { Warehouse_name, Description, Image, Location } = req.body;
    await db.query("UPDATE Warehouse SET Warehouse_name=?, Description=?, Image=?, Location=?, Update_at=NOW() WHERE Id=?", [Warehouse_name, Description, Image, Location, id]);
    const [[w]] = await db.query("SELECT * FROM Warehouse WHERE Id=?", [id]);
    res.json(w);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM Warehouse WHERE Id=?", [id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
