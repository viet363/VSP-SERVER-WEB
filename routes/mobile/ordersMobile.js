import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import { 
  getMyOrdersMobile, 
  getOrderDetailMobile, 
  createOrderMobile 
} from "../../controllers/mobile/ordersMobileController.js";

const router = express.Router();

router.get("/", mobileAuth, getMyOrdersMobile)
router.get("/:orderId", mobileAuth, getOrderDetailMobile)
router.post("/create", mobileAuth, createOrderMobile)


export default router;