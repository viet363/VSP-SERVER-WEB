import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "lequocviet362003@",
  database: "vsp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const testConnection = async () => {
  try {
    const conn = await db.getConnection();
    console.log("Kết nối MySQL thành công!");
    conn.release();
  } catch (err) {
    console.error("Kết nối thất bại:", err);
  }
};
