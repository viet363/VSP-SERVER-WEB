import { db } from "../../db.js";

const validateAddressInput = (req, res, next) => {
  const { receiver_name, phone, address_detail } = req.body;
  
  if (!receiver_name || !phone || !address_detail) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập đầy đủ thông tin: tên người nhận, số điện thoại và địa chỉ"
    });
  }
  
  const phoneRegex = /^(0|\+84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      message: "Số điện thoại không hợp lệ"
    });
  }
  
  next();
};

export const getAddressMobile = async (req, res) => {
  try {
    const userId = req.user.Id;
    
    const [rows] = await db.query(
      "SELECT * FROM user_address WHERE UserId = ? ORDER BY Is_default DESC, Id DESC",
      [userId]
    );
    
    res.json({ 
      success: true, 
      count: rows.length,
      data: rows 
    });
    
  } catch (error) {
    console.error("Get address error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi khi lấy danh sách địa chỉ" 
    });
  }
};

export const addAddressMobile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const userId = req.user.Id;
    const { receiver_name, phone, address_detail, is_default = 0 } = req.body;
    
    if (is_default === 1) {
      await connection.query(
        "UPDATE user_address SET Is_default = 0 WHERE UserId = ?",
        [userId]
      );
    }
    
    const [result] = await connection.query(
      "INSERT INTO user_address (UserId, Receiver_name, Phone, Address_detail, Is_default) VALUES (?, ?, ?, ?, ?)",
      [userId, receiver_name, phone, address_detail, is_default]
    );
    
    await connection.commit();
    
    res.status(201).json({ 
      success: true,
      message: "Thêm địa chỉ thành công",
      addressId: result.insertId
    });
    
  } catch (error) {
    await connection.rollback();
    console.error("Add address error:", error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        success: false, 
        message: "Địa chỉ đã tồn tại" 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Lỗi khi thêm địa chỉ" 
    });
  } finally {
    connection.release();
  }
};

export const deleteAddressMobile = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.Id;
    
    const [address] = await db.query(
      "SELECT * FROM user_address WHERE Id = ? AND UserId = ?",
      [id, userId]
    );
    
    if (address.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Địa chỉ không tồn tại" 
      });
    }
    
    if (address[0].Is_default === 1) {
      const [otherAddresses] = await db.query(
        "SELECT COUNT(*) as count FROM user_address WHERE UserId = ? AND Id != ?",
        [userId, id]
      );
      
      if (otherAddresses[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: "Không thể xóa địa chỉ mặc định. Vui lòng đặt địa chỉ khác làm mặc định trước."
        });
      }
    }
    
    await db.query(
      "DELETE FROM user_address WHERE Id = ? AND UserId = ?",
      [id, userId]
    );
    
    res.json({ 
      success: true, 
      message: "Xóa địa chỉ thành công" 
    });
    
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi khi xóa địa chỉ" 
    });
  }
};

export const updateAddressMobile = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const userId = req.user.Id;
    const { receiver_name, phone, address_detail, is_default = 0 } = req.body;
    
    const [address] = await connection.query(
      "SELECT * FROM user_address WHERE Id = ? AND UserId = ?",
      [id, userId]
    );
    
    if (address.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: "Địa chỉ không tồn tại" 
      });
    }
    
    if (is_default === 1) {
      await connection.query(
        "UPDATE user_address SET Is_default = 0 WHERE UserId = ? AND Id != ?",
        [userId, id]
      );
    }
    
    const [result] = await connection.query(
      "UPDATE user_address SET Receiver_name = ?, Phone = ?, Address_detail = ?, Is_default = ?, Updated_at = CURRENT_TIMESTAMP WHERE Id = ? AND UserId = ?",
      [receiver_name, phone, address_detail, is_default, id, userId]
    );
    
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: "Cập nhật thất bại" 
      });
    }
    
    await connection.commit();
    
    res.json({ 
      success: true,
      message: "Cập nhật địa chỉ thành công"
    });
    
  } catch (error) {
    await connection.rollback();
    console.error("Update address error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi khi cập nhật địa chỉ" 
    });
  } finally {
    connection.release();
  }
};

export const getDefaultAddressMobile = async (req, res) => {
  try {
    const userId = req.user.Id;
    
    const [rows] = await db.query(
      "SELECT * FROM user_address WHERE UserId = ? AND Is_default = 1 LIMIT 1",
      [userId]
    );
    
    res.json({ 
      success: true, 
      data: rows[0] || null 
    });
    
  } catch (error) {
    console.error("Get default address error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lỗi khi lấy địa chỉ mặc định" 
    });
  }
};

export { validateAddressInput };