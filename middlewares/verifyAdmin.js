import jwt from "jsonwebtoken";

export const verifyAdmin = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Không có token"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, "secretkey");

        req.adminId = decoded.id;
        req.adminRole = decoded.role;

        next();

    } catch (err) {
        return res.status(401).json({
            success: false,
            message: "Token không hợp lệ"
        });
    }
};
