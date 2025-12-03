import express from "express";
import {
  createVNPayUrlMobile,
  vnpayReturnMobile,
} from "../../controllers/mobile/paymentMobileController.js";

const router = express.Router();

router.get("/create", createVNPayUrlMobile);
router.get("/return", vnpayReturnMobile);

export default router;
