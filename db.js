import mysql from "mysql2/promise";

export const db = mysql.createPool({
  host: "trolley.proxy.rlwy.net",
  port: 24743, 
  user: "root",
  password: "oPLililtxmoIoRFNglgILWBpWHFakVAT",
  database: "vsp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

export const testConnection = async () => {
  try {
    const conn = await db.getConnection();

    console.log("Kết nối MySQL Railway thành công:", rows);

    conn.release();
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
  }
};
