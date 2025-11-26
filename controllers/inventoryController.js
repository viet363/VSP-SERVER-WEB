import { db } from "../db.js";

export const getInventory = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        i.Id, 
        p.Product_name, 
        w.Warehouse_name, 
        i.Stock, 
        i.Min_stock, 
        i.Updated_at
      FROM inventory i
      JOIN product p ON p.Id = i.ProductId
      JOIN warehouse w ON w.Id = i.WarehouseId
      ORDER BY i.Updated_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};

export const importStock = async (req, res) => {
  let connection;
  try {
    const { productId, warehouseId, quantity, note } = req.body;

    console.log('Import request:', { productId, warehouseId, quantity, note });

    // Validation
    if (!productId || !warehouseId || quantity == null || quantity <= 0) {
      return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // UPSERT inventory - sửa cú pháp
    const [result] = await connection.query(
      `INSERT INTO inventory (ProductId, WarehouseId, Stock) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE Stock = Stock + ?`,
      [productId, warehouseId, quantity, quantity]
    );

    console.log('UPSERT result:', result);

    // Get updated stock
    const [[inv]] = await connection.query(
      "SELECT Stock FROM inventory WHERE ProductId = ? AND WarehouseId = ?",
      [productId, warehouseId]
    );

    console.log('Updated inventory:', inv);

    // Insert log
    await connection.query(
      "INSERT INTO inventory_log (ProductId, WarehouseId, Change_type, Quantity, Note, Current_stock) VALUES (?, ?, 'IN', ?, ?, ?)",
      [productId, warehouseId, quantity, note || null, inv.Stock]
    );

    await connection.commit();
    res.json({ message: "Nhập kho thành công", current_stock: inv.Stock });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Import stock error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  } finally {
    if (connection) connection.release();
  }
};

export const exportStock = async (req, res) => {
  let connection;
  try {
    const { productId, warehouseId, quantity, note } = req.body;

    console.log('Export request:', { productId, warehouseId, quantity, note });

    // Validation
    if (!productId || !warehouseId || quantity == null || quantity <= 0) {
      return res.status(400).json({ error: "Dữ liệu không hợp lệ" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check current stock
    const [[inv]] = await connection.query(
      "SELECT Stock FROM inventory WHERE ProductId = ? AND WarehouseId = ?",
      [productId, warehouseId]
    );

    console.log('Current inventory:', inv);

    if (!inv) {
      await connection.rollback();
      return res.status(400).json({ error: "Sản phẩm không tồn tại trong kho này" });
    }

    if (inv.Stock < quantity) {
      await connection.rollback();
      return res.status(400).json({ error: `Không đủ hàng. Tồn kho hiện tại: ${inv.Stock}` });
    }

    // Update inventory
    await connection.query(
      "UPDATE inventory SET Stock = Stock - ? WHERE ProductId = ? AND WarehouseId = ?",
      [quantity, productId, warehouseId]
    );

    // Get new stock
    const [[newInv]] = await connection.query(
      "SELECT Stock FROM inventory WHERE ProductId = ? AND WarehouseId = ?",
      [productId, warehouseId]
    );

    console.log('New inventory after export:', newInv);

    // Insert log
    await connection.query(
      "INSERT INTO inventory_log (ProductId, WarehouseId, Change_type, Quantity, Note, Current_stock) VALUES (?, ?, 'OUT', ?, ?, ?)",
      [productId, warehouseId, quantity, note || null, newInv.Stock]
    );

    await connection.commit();
    res.json({ message: "Xuất kho thành công", current_stock: newInv.Stock });

  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Export stock error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  } finally {
    if (connection) connection.release();
  }
};

export const getInventoryLog = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT il.*, p.Product_name, w.Warehouse_name
      FROM inventory_log il
      JOIN product p ON p.Id = il.ProductId
      JOIN warehouse w ON w.Id = il.WarehouseId
      ORDER BY il.Created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get inventory log error:', err);
    res.status(500).json({ error: "Lỗi server: " + err.message });
  }
};