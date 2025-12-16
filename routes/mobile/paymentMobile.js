import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import {
  createVNPayUrlMobile,
  vnpayReturnMobile,
  checkPaymentStatus
} from "../../controllers/mobile/paymentMobileController.js";

const router = express.Router();

router.get("/return", vnpayReturnMobile);

router.use(mobileAuth);
router.post("/create", createVNPayUrlMobile);
router.get("/status/:orderId", checkPaymentStatus);

export default router;