import { db } from "../db.js";

export const getOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        o.*, 
        u.Fullname AS customer_name,
        (
          SELECT COALESCE(SUM(od.Quantity * od.Unit_price - od.Discount_amount), 0)
          FROM order_detail od
          WHERE od.OrderId = o.Id
        ) AS total
      FROM orders o
      LEFT JOIN user u ON u.Id = o.UserId
      ORDER BY o.Order_date DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};



export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[order]] = await db.query(`
      SELECT 
        o.*, 
        u.Fullname AS customer_name, 
        u.Phone, 
        u.Email,
        (
          SELECT COALESCE(SUM(od.Quantity * od.Unit_price - od.Discount_amount), 0)
          FROM order_detail od
          WHERE od.OrderId = o.Id
        ) AS total
      FROM orders o
      LEFT JOIN user u ON u.Id = o.UserId
      WHERE o.Id = ?
    `, [id]);

    const [items] = await db.query(`
      SELECT 
        od.*, 
        p.Product_name,
        (od.Quantity * od.Unit_price - od.Discount_amount) AS subtotal
      FROM order_detail od
      LEFT JOIN product p ON p.Id = od.ProductId
      WHERE od.OrderId = ?
    `, [id]);

    res.json({ order, items });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};



export const createOrder = async (req, res) => {
  try {
    const { UserId, Ship_address, Ship_fee, Payment_type, AddressId, items } = req.body;

    const [result] = await db.query(
      `INSERT INTO Orders (UserId, Ship_address, Ship_fee, Payment_type, AddressId) 
       VALUES (?, ?, ?, ?, ?)`,
      [UserId, Ship_address, Ship_fee || 0, Payment_type, AddressId || null]
    );

    const orderId = result.insertId;
    for (const it of items) {
      await db.query(
        "INSERT INTO Order_detail (OrderId, ProductId, Quantity, Unit_price, Discount_percentage, Discount_amount) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, it.ProductId, it.Quantity, it.Unit_price, it.Discount_percentage || 0, it.Discount_amount || 0]
      );
    }
    res.status(201).json({ orderId, message: "Order created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.query("UPDATE Orders SET Order_status=?, Update_at=NOW() WHERE Id=?", [status, id]);

    if (status === "Delivered") {
      const [items] = await db.query("SELECT * FROM Order_detail WHERE OrderId=?", [id]);
      for (const it of items) {
        const [[inventory]] = await db.query("SELECT * FROM Inventory WHERE ProductId=? ORDER BY Stock DESC LIMIT 1", [it.ProductId]);
        if (inventory) {
          await db.query("UPDATE Inventory SET Stock = Stock - ? WHERE Id = ?", [it.Quantity, inventory.Id]);
          const [[newInv]] = await db.query("SELECT Stock FROM Inventory WHERE Id=?", [inventory.Id]);
          await db.query("INSERT INTO Inventory_log (ProductId, WarehouseId, Change_type, Quantity, Note, Current_stock) VALUES (?, ?, 'OUT', ?, ?, ?)", [it.ProductId, inventory.WarehouseId, it.Quantity, `Order ${id}`, newInv.Stock]);
        }
      }
    }

    res.json({ message: "Status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
