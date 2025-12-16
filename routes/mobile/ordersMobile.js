import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import {
  getMyOrdersMobile,
  getOrderDetailMobile,
  createOrderMobile,
  updateOrderStatus
} from "../../controllers/mobile/ordersMobileController.js";

const router = express.Router();

router.use(mobileAuth);

router.get("/my", getMyOrdersMobile);
router.get("/:orderId", getOrderDetailMobile);
router.post("/create", createOrderMobile);
router.put("/:orderId/status", updateOrderStatus);

export default router;