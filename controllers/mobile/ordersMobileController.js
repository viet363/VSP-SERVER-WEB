import { db } from "../../db.js";

export const getMyOrdersMobile = async (req, res) => {
  try {
    const userId = req.user.Id;

    const [orders] = await db.query(
      `SELECT 
        o.Id, o.UserId, o.Order_date as orderDate, o.Shipped_date as shippedDate,
        o.Note, o.Ship_address as shipAddress, o.Ship_fee as shipFee,
        o.Paid_date as paidDate, o.Order_status as orderStatus,
        o.Payment_type as paymentType, o.Create_at as createAt,
        o.Update_at as updateAt, o.AddressId,
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
          od.Id, od.OrderId as orderId, od.ProductId as productId,
          od.Quantity as quantity, od.Unit_price as unitPrice,
          od.Discount_percentage as discountPercentage,
          od.Discount_amount as discountAmount,
          p.Product_name as productName, p.picUrl as productImage
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
        o.Id, o.UserId, o.Order_date as orderDate, o.Shipped_date as shippedDate,
        o.Note, o.Ship_address as shipAddress, o.Ship_fee as shipFee,
        o.Paid_date as paidDate, o.Order_status as orderStatus,
        o.Payment_type as paymentType, o.Create_at as createAt,
        o.Update_at as updateAt, o.AddressId
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
        od.Id, od.OrderId as orderId, od.ProductId as productId,
        od.Quantity as quantity, od.Unit_price as unitPrice,
        od.Discount_percentage as discountPercentage,
        od.Discount_amount as discountAmount,
        p.Product_name as productName, p.picUrl as productImage
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

    const { addressId, paymentMethod, items, note, shipFee = 0 } = req.body;
    const userId = req.user.Id;

    // Lấy thông tin địa chỉ
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

    // Tính tổng tiền
    let total = 0;
    for (let item of items) {
      total += item.quantity * item.unitPrice;
    }
    total += shipFee;

    // Tạo order
    const [orderResult] = await connection.query(
      `INSERT INTO orders 
       (UserId, Ship_address, Ship_fee, Payment_type, Note, Order_status) 
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [userId, shipAddress, shipFee, paymentMethod, note]
    );

    const orderId = orderResult.insertId;

    // Thêm order details
    for (let item of items) {
      await connection.query(
        `INSERT INTO order_detail 
         (OrderId, ProductId, Quantity, Unit_price) 
         VALUES (?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, item.unitPrice]
      );

      // Cập nhật inventory (nếu cần)
      await connection.query(
        `UPDATE inventory SET Stock = Stock - ? 
         WHERE ProductId = ? AND WarehouseId = 1`,
        [item.quantity, item.productId]
      );
    }

    // Xóa cart
    const [carts] = await connection.query(
      "SELECT Id FROM cart WHERE UserId = ?",
      [userId]
    );

    if (carts.length > 0) {
      const cartId = carts[0].Id;
      await connection.query(
        "DELETE FROM cart_detail WHERE CartId = ?",
        [cartId]
      );
    }

    await connection.commit();

    res.json({ 
      success: true, 
      message: "Tạo đơn hàng thành công",
      orderId: orderId 
    });

  } catch (error) {
    await connection.rollback();
    console.error("Create order error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi server" 
    });
  } finally {
    connection.release();
  }
};