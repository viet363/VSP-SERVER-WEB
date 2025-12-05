export const getDashboardData = async (req, res) => {
    try {
        console.log('Fetching dashboard data...');
        
        // Khởi tạo dữ liệu mặc định
        let dashboardData = {
            totalCustomers: 0,
            totalProducts: 0,
            totalOrders: 0,
            totalRevenue: 0,
            topCustomers: [],
            latestOrders: [],
            monthlyRevenue: Array(12).fill(0)
        };

        try {
            // ... (các query khác giữ nguyên) ...
            
            // Monthly revenue - SỬA LẠI
            const [monthlyRevenueData] = await db.query(`
                SELECT 
                    MONTH(o.Order_date) as month,
                    COALESCE(SUM(od.Quantity * od.Unit_price), 0) as revenue
                FROM orders o
                INNER JOIN order_detail od ON o.Id = od.OrderId
                WHERE YEAR(o.Order_date) = YEAR(CURDATE()) 
                    AND o.Order_status = 'Delivered'
                GROUP BY MONTH(o.Order_date)
                ORDER BY month
            `);
            
            // Cập nhật monthly revenue
            if (monthlyRevenueData && monthlyRevenueData.length > 0) {
                monthlyRevenueData.forEach(item => {
                    const monthIndex = item.month - 1;
                    if (monthIndex >= 0 && monthIndex < 12) {
                        dashboardData.monthlyRevenue[monthIndex] = parseFloat(item.revenue) || 0;
                    }
                });
            }
            
        } catch (dbError) {
            console.error('Database error:', dbError);
        }
        
        console.log('Final dashboard data:', dashboardData);
        res.json(dashboardData);
        
    } catch (err) {
        console.error('Dashboard controller error:', err);
        res.status(500).json({ error: "Lỗi server: " + err.message });
    }
};