import cron from "node-cron";
import { db } from "../db.js";

export const autoOrderStatus = () => {
  console.log("Auto Order Status Cron Started"); 


  cron.schedule("*/10 * * * *", async () => {
    try {
      console.log("Checking and updating order status..."); 

      await db.query(`
        UPDATE orders
        SET Order_status = 'Cancelled'
        WHERE Order_status = 'Pending'
        AND TIMESTAMPDIFF(HOUR, Order_date, NOW()) >= 24
      `);

      await db.query(`
        UPDATE orders
        SET Order_status = 'Shipped'
        WHERE Order_status = 'Processing'
        AND TIMESTAMPDIFF(HOUR, Order_date, NOW()) >= 48
      `);

      await db.query(`
        UPDATE orders
        SET Order_status = 'Delivered'
        WHERE Order_status = 'Shipped'
        AND TIMESTAMPDIFF(DAY, Order_date, NOW()) >= 5
      `);

      console.log(" Auto update order status completed."); 

    } catch (error) {
      console.error("Auto update failed:", error); 
    }
  });
};
