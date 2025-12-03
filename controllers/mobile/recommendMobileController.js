import { db } from "../../db.js";

export const getRecommendedProducts = (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ success: false, message: "Missing userId" });
    }

    const sql = `
        SELECT 
            p.Id,
            p.Title,
            p.Description,
            p.Price,
            p.ImageUrl,
            p.Rating
        FROM user_recommendation ur
        JOIN product p ON ur.ProductId = p.Id
        WHERE ur.UserId = ?
        AND ur.Algorithm = 'ncf'
        ORDER BY ur.Score DESC
        LIMIT 10
    `;

    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ success: false, message: "Server error" });
        }

        const formattedData = result.map(item => ({
            Id: item.Id,
            Title: item.Title,
            Description: item.Description,
            Price: parseFloat(item.Price),
            ImageUrl: item.ImageUrl,
            Rating: item.Rating ? parseFloat(item.Rating) : null
        }));

        return res.json({
            success: true,
            count: formattedData.length,
            data: formattedData
        });
    });
};