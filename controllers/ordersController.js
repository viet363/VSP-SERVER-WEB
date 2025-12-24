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
    const { Order_status, status } = req.body;
    
    const receivedStatus = Order_status || status;
    
    if (!receivedStatus) {
      return res.status(400).json({ error: "Trạng thái không được để trống" });
    }

    const normalizedStatus = receivedStatus.charAt(0).toUpperCase() + receivedStatus.slice(1).toLowerCase();
    
    const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];
    if (!validStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" });
    }

    // 1. Lấy trạng thái hiện tại của đơn hàng
    const [[currentOrder]] = await db.query(
      "SELECT Order_status FROM orders WHERE Id=?",
      [id]
    );

    if (!currentOrder) {
      return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    }

    const currentStatus = currentOrder.Order_status;
    const newStatus = normalizedStatus;

    // 2. Định nghĩa luồng chuyển trạng thái hợp lệ
    const validTransitions = {
      'Pending': ['Processing', 'Cancelled'], // Từ Pending chỉ được chuyển sang Processing hoặc Cancelled
      'Processing': ['Shipped', 'Cancelled'], // Từ Processing chỉ được chuyển sang Shipped hoặc Cancelled
      'Shipped': ['Delivered', 'Returned'],   // Từ Shipped chỉ được chuyển sang Delivered hoặc Returned
      'Delivered': ['Returned'],              // Từ Delivered chỉ được chuyển sang Returned
      'Cancelled': [],                        // Đã hủy thì không thể chuyển sang trạng thái khác
      'Returned': []                          // Đã trả hàng thì không thể chuyển sang trạng thái khác
    };

    // 3. Kiểm tra xem có được phép chuyển trạng thái không
    const allowedNextStatuses = validTransitions[currentStatus] || [];
    
    // Cho phép giữ nguyên trạng thái (không thay đổi)
    if (newStatus === currentStatus) {
      return res.json({ message: "Trạng thái không thay đổi" });
    }

    // Kiểm tra chuyển trạng thái có hợp lệ không
    if (!allowedNextStatuses.includes(newStatus)) {
      let errorMessage = `Không thể chuyển từ "${currentStatus}" sang "${newStatus}". `;
      
      if (allowedNextStatuses.length > 0) {
        errorMessage += `Chỉ được phép chuyển sang: ${allowedNextStatuses.join(', ')}`;
      } else {
        errorMessage += `Đơn hàng đã ở trạng thái cuối cùng, không thể thay đổi.`;
      }
      
      return res.status(400).json({ error: errorMessage });
    }

    // 4. Thực hiện cập nhật
    await db.query(
      "UPDATE orders SET Order_status=?, Update_at=NOW() WHERE Id=?",
      [newStatus, id]
    );

    // 5. Gửi thông báo
    const [[order]] = await db.query(
      "SELECT UserId FROM orders WHERE Id=?",
      [id]
    );

    const statusText = {
      Pending: "đang chờ xác nhận",
      Processing: "đang xử lý",
      Shipped: "đang giao hàng",
      Delivered: "đã giao thành công",
      Cancelled: "đã hủy",
      Returned: "đã trả hàng"
    };

    if (order && order.UserId) {
      await db.query(
        `INSERT INTO notification (UserId, Title, Message)
         VALUES (?, ?, ?)`,
        [
          order.UserId,
          "Cập nhật đơn hàng",
          `Đơn hàng #${id} đã chuyển từ "${statusText[currentStatus]}" sang "${statusText[newStatus]}"`
        ]
      );
    }

    res.json({ 
      message: "Cập nhật trạng thái thành công",
      previousStatus: currentStatus,
      newStatus: newStatus
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
