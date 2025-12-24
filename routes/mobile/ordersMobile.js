import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import {
  getOrders,
  getOrderDetailMobile,
  createOrderMobile,
  updateOrderStatus
} from "../../controllers/mobile/ordersMobileController.js";

const router = express.Router();

router.use(mobileAuth);

router.get("/", getOrders);
router.get("/:orderId", getOrderDetailMobile);
router.post("/create", createOrderMobile);
router.patch("/:orderId/status", updateOrderStatus);

export default router;