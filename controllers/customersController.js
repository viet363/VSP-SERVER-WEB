import { db } from "../db.js";

export const getCustomers = async (req, res) => {
  try {
    console.log('=== START getCustomers ===');
    
    const [users] = await db.query(`
      SELECT 
        u.Id,
        u.Username,
        u.Email,
        u.Fullname,
        u.Phone,
        u.Create_at
      FROM user u
      ORDER BY u.Id DESC
    `);

    console.log(`Found ${users.length} users`);

    const customersWithStats = await Promise.all(
      users.map(async (user) => {
        try {
          console.log(`Processing user ${user.Id}: ${user.Fullname}`);
          
          const [addresses] = await db.query(
            `SELECT Address_detail, Is_default 
             FROM user_address 
             WHERE UserId = ? 
             ORDER BY Is_default DESC 
             LIMIT 1`,
            [user.Id]
          );
          
          const address = addresses.length > 0 
            ? addresses[0].Address_detail 
            : "Không có địa chỉ";

          const [[orderResult]] = await db.query(
            `SELECT COUNT(*) AS total_orders FROM orders WHERE UserId = ?`,
            [user.Id]
          );
          const total_orders = orderResult?.total_orders || 0;

          const [[spendResult]] = await db.query(
            `SELECT 
              SUM(od.Quantity * od.Unit_price - od.Discount_amount) AS total_spend
             FROM orders o
             JOIN order_detail od ON o.Id = od.OrderId
             WHERE o.UserId = ?`,
            [user.Id]
          );
          
          const total_spend = spendResult?.total_spend || 0;

          console.log(`User ${user.Id}: orders=${total_orders}, spend=${total_spend}, address=${address}`);

          return {
            Id: user.Id,
            Fullname: user.Fullname || 'Không có tên',
            Email: user.Email || 'Không có email',
            Phone: user.Phone || 'Không có SĐT',
            address: address,
            total_orders: Number(total_orders),
            total_spend: Number(total_spend),
            Create_at: user.Create_at
          };
        } catch (userErr) {
          console.error(`Error processing user ${user.Id}:`, userErr);
          return {
            Id: user.Id,
            Fullname: user.Fullname || 'Không có tên',
            Email: user.Email || 'Không có email',
            Phone: user.Phone || 'Không có SĐT',
            address: "Không có địa chỉ",
            total_orders: 0,
            total_spend: 0,
            Create_at: user.Create_at
          };
        }
      })
    );

    console.log('=== END getCustomers, returning data ===');
    res.json(customersWithStats);

  } catch (err) {
    console.error('Error in getCustomers:', err);
    res.status(500).json({ 
      error: "Lỗi server", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [[user]] = await db.query("SELECT * FROM user WHERE Id=?", [id]);
    if (!user) {
      return res.status(404).json({ error: "Không tìm thấy khách hàng" });
    }

    const [addresses] = await db.query(
      `SELECT Address_detail, Is_default 
       FROM user_address 
       WHERE UserId = ? 
       ORDER BY Is_default DESC 
       LIMIT 1`,
      [id]
    );
    
    const address = addresses.length > 0 
      ? addresses[0].Address_detail 
      : "Không có địa chỉ";

    const [[{ total_orders = 0 }]] = await db.query(
      "SELECT COUNT(*) as total_orders FROM orders WHERE UserId=?", 
      [id]
    );
    
    const [[{ total_spend = 0 }]] = await db.query(
      `SELECT 
        SUM(od.Quantity * od.Unit_price - od.Discount_amount) AS total_spend
       FROM orders o
       JOIN order_detail od ON o.Id = od.OrderId
       WHERE o.UserId = ?`, 
      [id]
    );

    res.json({ 
      ...user, 
      address,
      total_orders: Number(total_orders),
      total_spend: Number(total_spend) || 0
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};