import { db } from "../db.js";

// Lấy danh sách toàn bộ khuyến mãi
export const getPromotions = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.Id, p.ProductId, pr.Product_name, p.Discount_amount,
                   p.Start_date, p.End_date, p.Is_active
            FROM product_discount p
            LEFT JOIN product pr ON pr.Id = p.ProductId
            ORDER BY p.Id DESC
        `);
        console.log("Promotions retrieved:", rows);
        res.json(rows);
    } catch (err) {
        console.error("Error getting promotions:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Thêm mới khuyến mãi
export const createPromotion = async (req, res) => {
    const { ProductId, Discount_amount, Start_date, End_date, Is_active } = req.body;

    try {
        await db.query(
            `INSERT INTO product_discount (ProductId, Discount_amount, Start_date, End_date, Is_active)
             VALUES (?, ?, ?, ?, ?)`,
            [ProductId, Discount_amount, Start_date, End_date, Is_active]
        );
        res.json({ message: "Thêm khuyến mãi thành công!" });
    } catch (err) {
        console.error("Error adding promotion:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Cập nhật khuyến mãi
export const updatePromotion = async (req, res) => {
    const promotionId = req.params.id;
    const { ProductId, Discount_amount, Start_date, End_date, Is_active } = req.body;

    try {
        await db.query(
            `UPDATE product_discount 
             SET ProductId=?, Discount_amount=?, Start_date=?, End_date=?, Is_active=?
             WHERE Id=?`,
            [ProductId, Discount_amount, Start_date, End_date, Is_active, promotionId]
        );
        res.json({ message: "Cập nhật khuyến mãi thành công!" });
    } catch (err) {
        console.error("Error updating promotion:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Xóa khuyến mãi
export const deletePromotion = async (req, res) => {
    const promotionId = req.params.id;

    try {
        await db.query(`DELETE FROM product_discount WHERE Id=?`, [promotionId]);
        res.json({ message: "Xóa khuyến mãi thành công!" });
    } catch (err) {
        console.error("Error deleting promotion:", err);
        res.status(500).json({ message: "Server error" });
    }
};
