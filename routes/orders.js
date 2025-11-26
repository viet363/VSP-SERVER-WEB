import express from 'express';
import { db } from '../db.js';
const router = express.Router();

// GET all orders
router.get('/', async (req, res) => {
    try {
        const [orders] = await db.query(`
            SELECT o.Id, o.UserId, u.Fullname AS CustomerName, o.Ship_address, o.Order_status AS Status, o.Payment_type AS PaymentType,
                   o.Ship_fee, o.Order_date AS Date, SUM(od.Quantity * od.Unit_price) AS Total
            FROM Orders o
            LEFT JOIN User u ON o.UserId = u.Id
            LEFT JOIN Order_detail od ON o.Id = od.OrderId
            GROUP BY o.Id
        `);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update order status
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { Status } = req.body;
    try {
        await db.query('UPDATE Orders SET Order_status=? WHERE Id=?', [Status, id]);
        res.json({ message: 'Order updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE order
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM Orders WHERE Id=?', [id]);
        res.json({ message: 'Order deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
