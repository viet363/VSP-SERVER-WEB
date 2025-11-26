import bcrypt from "bcrypt";
import { db } from "../db.js";

// ================= REGISTER =================
export const register = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username và password là bắt buộc" });
    }

    try {
        // Kiểm tra username đã tồn tại chưa
        const [existing] = await db.query(
            "SELECT Id FROM user WHERE Username = ?",
            [username]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: "Username đã tồn tại" });
        }

        // Mã hóa mật khẩu
        const hashedPassword = await bcrypt.hash(password, 10);

        // Thêm user mới vào bảng user
        const [result] = await db.query(
            "INSERT INTO user (Username, Password, Create_at) VALUES (?, ?, NOW())",
            [username, hashedPassword]
        );

        const userId = result.insertId;

        // Gán role admin cho user mới
        const [role] = await db.query(
            "SELECT Id FROM role WHERE Name = ?",
            ["admin"]
        );

        if (role.length === 0) {
            return res.status(500).json({ message: "Role admin chưa tồn tại trong hệ thống" });
        }

        await db.query(
            "INSERT INTO user_role (UserId, RoleId) VALUES (?, ?)",
            [userId, role[0].Id]
        );

        return res.status(201).json({
            message: "Đăng ký thành công!",
            user: {
                id: userId,
                username,
                role: "admin"
            }
        });

    } catch (error) {
        console.error("CRITICAL REGISTER ERROR:", error);
        return res.status(500).json({ message: "Lỗi hệ thống. Vui lòng thử lại." });
    }
};

// ================= LOGIN =================
export const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username và password là bắt buộc" });
    }

    try {
        const [rows] = await db.query(
            `SELECT u.Id, u.Username, u.Password, r.Name AS roleName
             FROM user u
             JOIN user_role ur ON ur.UserId = u.Id
             JOIN role r ON r.Id = ur.RoleId
             WHERE u.Username = ?`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(400).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
        }

        const user = rows[0];

        // So sánh password
        const match = await bcrypt.compare(password, user.Password);

        if (!match) {
            return res.status(400).json({ message: "Sai tên đăng nhập hoặc mật khẩu" });
        }

        if (user.roleName !== "admin" && user.roleName !== "ql") {
            return res.status(403).json({ message: "Bạn không có quyền đăng nhập admin" });
        }

        return res.json({
            message: "Đăng nhập thành công!",
            user: {
                id: user.Id,
                username: user.Username,
                role: user.roleName
            }
        });

    } catch (error) {
        console.error("CRITICAL LOGIN ERROR:", error);
        return res.status(500).json({ message: "Lỗi hệ thống không xác định. Vui lòng thử lại." });
    }
};
