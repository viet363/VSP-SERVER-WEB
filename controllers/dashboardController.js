import { db } from "../db.js";

export const getDashboardData = async (req, res) => {
    try {
        console.log('Fetching dashboard data...');

        // Dữ liệu mặc định
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
            // Total customers
            const [[customerResult]] = await db.query(`
                SELECT COUNT(*) as totalCustomers FROM user
            `);
            dashboardData.totalCustomers = parseInt(customerResult?.totalCustomers) || 0;

            // Total products
            const [[productResult]] = await db.query(`
                SELECT COUNT(*) as totalProducts FROM product
            `);
            dashboardData.totalProducts = parseInt(productResult?.totalProducts) || 0;

            // Total orders
            const [[orderResult]] = await db.query(`
                SELECT COUNT(*) as totalOrders FROM orders
            `);
            dashboardData.totalOrders = parseInt(orderResult?.totalOrders) || 0;

            // Total revenue
            const [[revenueResult]] = await db.query(`
                SELECT COALESCE(SUM(od.Quantity * od.Unit_price), 0) as totalRevenue 
                FROM order_detail od
                INNER JOIN orders o ON od.OrderId = o.Id
                WHERE o.Order_status = 'Delivered'
            `);
            dashboardData.totalRevenue = parseFloat(revenueResult?.totalRevenue) || 0;

            // Top customers
            const [topCustomers] = await db.query(`
                SELECT 
                    u.Id,
                    u.Fullname,
                    COUNT(o.Id) as total_orders,
                    COALESCE(SUM(od.Quantity * od.Unit_price), 0) as total_spend
                FROM user u
                LEFT JOIN orders o ON u.Id = o.UserId
                LEFT JOIN order_detail od ON o.Id = od.OrderId
                GROUP BY u.Id, u.Fullname
                ORDER BY total_spend DESC
                LIMIT 5
            `);
            dashboardData.topCustomers = topCustomers || [];

            // Latest orders
            const [latestOrders] = await db.query(`
                SELECT 
                    o.Id,
                    o.Order_date,
                    o.Order_status,
                    o.Payment_type,
                    u.Fullname as customer_name,
                    COALESCE(
                        (SELECT SUM(od.Quantity * od.Unit_price)
                        FROM order_detail od
                        WHERE od.OrderId = o.Id), 0
                    ) as total_amount
                FROM orders o
                LEFT JOIN user u ON o.UserId = u.Id
                ORDER BY o.Order_date DESC
                LIMIT 5
            `);
            dashboardData.latestOrders = latestOrders || [];

            // Monthly revenue
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

            if (monthlyRevenueData && monthlyRevenueData.length > 0) {
                monthlyRevenueData.forEach(item => {
                    const monthIndex = item.month - 1;
                    if (monthIndex >= 0 && monthIndex < 12) {
                        dashboardData.monthlyRevenue[monthIndex] =
                            parseFloat(item.revenue) || 0;
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
        res.json({
            totalCustomers: 0,
            totalProducts: 0,
            totalOrders: 0,
            totalRevenue: 0,
            topCustomers: [],
            latestOrders: [],
            monthlyRevenue: Array(12).fill(0)
        });
    }
};
