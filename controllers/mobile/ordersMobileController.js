import { db } from "../../db.js";

export const getMyOrdersMobile = async (req, res) => {
  try {
    const userId = req.user.Id;

    const [orders] = await db.query(
      `SELECT 
        o.Id, o.UserId, o.Order_date, o.Shipped_date,
        o.Note, o.Ship_address, o.Ship_fee,
        o.Paid_date, o.Order_status,
        o.Payment_type, o.Create_at,
        o.Update_at, o.AddressId,
        SUM(od.Quantity * od.Unit_price) as total
       FROM orders o
       LEFT JOIN order_detail od ON o.Id = od.OrderId
       WHERE o.UserId = ?
       GROUP BY o.Id
       ORDER BY o.Order_date DESC`,
      [userId]
    );

    // Lấy chi tiết items cho mỗi order
    for (let order of orders) {
      const [items] = await db.query(
        `SELECT 
          od.Id, od.OrderId, od.ProductId,
          od.Quantity, od.Unit_price,
          od.Discount_percentage,
          od.Discount_amount,
          p.Product_name, p.picUrl
         FROM order_detail od
         JOIN product p ON p.Id = od.ProductId
         WHERE od.OrderId = ?`,
        [order.Id]
      );
      order.items = items;
    }

    res.json({
      success: true,
      orders: orders
    });

  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const getOrderDetailMobile = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.Id;

    // Lấy thông tin order
    const [orders] = await db.query(
      `SELECT 
        o.Id, o.UserId, o.Order_date, o.Shipped_date,
        o.Note, o.Ship_address, o.Ship_fee,
        o.Paid_date, o.Order_status,
        o.Payment_type, o.Create_at,
        o.Update_at, o.AddressId
       FROM orders o
       WHERE o.Id = ? AND o.UserId = ?`,
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy đơn hàng" 
      });
    }

    const order = orders[0];

    // Lấy chi tiết items
    const [items] = await db.query(
      `SELECT 
        od.Id, od.OrderId, od.ProductId,
        od.Quantity, od.Unit_price,
        od.Discount_percentage,
        od.Discount_amount,
        p.Product_name, p.picUrl
       FROM order_detail od
       JOIN product p ON p.Id = od.ProductId
       WHERE od.OrderId = ?`,
      [orderId]
    );

    // Tính tổng tiền
    const [totals] = await db.query(
      `SELECT SUM(Quantity * Unit_price) as total
       FROM order_detail WHERE OrderId = ?`,
      [orderId]
    );

    order.total = totals[0].total || 0;
    order.items = items;

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error("Get order detail error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};

export const createOrderMobile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { addressId, paymentMethod, note, shipFee = 0 } = req.body;
    const userId = req.user.Id;

    if (!addressId || !paymentMethod) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: "Thiếu thông tin bắt buộc" 
      });
    }

    const [addresses] = await connection.query(
      "SELECT * FROM user_address WHERE Id = ? AND UserId = ?",
      [addressId, userId]
    );

    if (addresses.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: "Địa chỉ không hợp lệ" 
      });
    }

    const address = addresses[0];
    const shipAddress = `${address.Address_detail} - ${address.Receiver_name} - ${address.Phone}`;

    const [carts] = await connection.query(
      "SELECT Id FROM cart WHERE UserId = ?",
      [userId]
    );

    if (carts.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: "Giỏ hàng trống" 
      });
    }

    const cartId = carts[0].Id;

    const [cartItems] = await connection.query(`
      SELECT cd.Id as cartDetailId, cd.ProductId, cd.Quantity, cd.Unit_price, 
             p.Product_name, p.Price, i.Stock as availableStock
      FROM cart_detail cd
      JOIN product p ON p.Id = cd.ProductId
      LEFT JOIN inventory i ON i.ProductId = p.Id
      WHERE cd.CartId = ?
    `, [cartId]);

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: "Giỏ hàng trống" 
      });
    }

    const productMap = new Map(); 
    
    for (let item of cartItems) {
      if (item.availableStock !== null && item.availableStock < item.Quantity) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: `Sản phẩm "${item.Product_name}" không đủ tồn kho. Còn lại: ${item.availableStock}` 
        });
      }
      
      if (productMap.has(item.ProductId)) {
        const existingItem = productMap.get(item.ProductId);
        existingItem.Quantity += item.Quantity;
      } else {
        productMap.set(item.ProductId, {
          ...item,
          cartDetailIds: [item.cartDetailId] 
        });
      }
    }

    const uniqueCartItems = Array.from(productMap.values());

    let total = 0;
    for (let item of uniqueCartItems) {
      total += item.Quantity * item.Unit_price;
    }
    total += parseFloat(shipFee);

    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (UserId, Ship_address, Ship_fee, Payment_type, Note, Order_status, AddressId) 
       VALUES (?, ?, ?, ?, ?, 'Pending', ?)`,
      [userId, shipAddress, shipFee, paymentMethod, note || '', addressId]
    );

    const orderId = orderResult.insertId;

    for (let item of uniqueCartItems) {
      const [existingItems] = await connection.query(
        "SELECT Id FROM order_detail WHERE OrderId = ? AND ProductId = ?",
        [orderId, item.ProductId]
      );

      if (existingItems.length === 0) {
        await connection.query(
          `INSERT INTO order_detail 
           (OrderId, ProductId, Quantity, Unit_price) 
           VALUES (?, ?, ?, ?)`,
          [orderId, item.ProductId, item.Quantity, item.Unit_price]
        );
      } else {
        await connection.query(
          `UPDATE order_detail 
           SET Quantity = Quantity + ?, Unit_price = ?
           WHERE OrderId = ? AND ProductId = ?`,
          [item.Quantity, item.Unit_price, orderId, item.ProductId]
        );
      }

      if (item.availableStock !== null) {
        await connection.query(
          `UPDATE inventory SET Stock = Stock - ? 
           WHERE ProductId = ?`,
          [item.Quantity, item.ProductId]
        );

        const [inventory] = await connection.query(
          `SELECT WarehouseId, Stock FROM inventory WHERE ProductId = ?`,
          [item.ProductId]
        );
        
        if (inventory.length > 0) {
          const currentStock = inventory[0].Stock - item.Quantity;
          await connection.query(
            `INSERT INTO inventory_log 
             (ProductId, WarehouseId, Change_type, Quantity, Note, Current_stock)
             VALUES (?, ?, 'OUT', ?, 'Order #${orderId}', ?)`,
            [item.ProductId, inventory[0].WarehouseId, item.Quantity, currentStock]
          );
        }
      }
    }
    await connection.query(
      "DELETE FROM cart_detail WHERE CartId = ?",
      [cartId]
    );

    await connection.commit();
    if (paymentMethod === 'VNPay') {
      await connection.query(
        `INSERT INTO payment 
         (OrderId, Payment_method, Amount, Payment_status, Transaction_code)
         VALUES (?, 'VNPay', ?, 'Pending', NULL)`,
        [orderId, total]
      );
    }

    res.json({ 
      success: true, 
      message: "Tạo đơn hàng thành công",
      orderId: orderId,
      totalAmount: total
    });

  } catch (error) {
    await connection.rollback();
    console.error("Create order error:", error);
    
    let errorMessage = "Lỗi server";
    if (error.code === 'ER_DUP_ENTRY') {
      errorMessage = "Sản phẩm đã tồn tại trong đơn hàng. Vui lòng thử lại.";
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage + ": " + error.message 
    });
  } finally {
    connection.release();
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const userId = req.user.Id;

    // Kiểm tra order thuộc về user
    const [orders] = await db.query(
      "SELECT Id FROM orders WHERE Id = ? AND UserId = ?",
      [orderId, userId]
    );

    if (orders.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy đơn hàng" 
      });
    }

    await db.query(
      "UPDATE orders SET Order_status = ?, Update_at = NOW() WHERE Id = ?",
      [status, orderId]
    );

    res.json({ 
      success: true, 
      message: "Cập nhật trạng thái thành công" 
    });

  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  }
};