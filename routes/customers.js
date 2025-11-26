import express from 'express';
import { db } from '../db.js';
const router = express.Router();

// GET all customers
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT Id, Username, Fullname, Email, Phone, Gender, Birthday, Avatar FROM User');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update customer
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    const setStr = Object.keys(fields).map(k => `${k}=?`).join(',');
    try {
        await db.query(`UPDATE User SET ${setStr} WHERE Id=?`, [...Object.values(fields), id]);
        res.json({ message: 'Customer updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE customer
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM User WHERE Id=?', [id]);
        res.json({ message: 'Customer deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
