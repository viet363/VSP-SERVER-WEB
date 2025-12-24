import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import {
  createVNPayUrlMobile,
  vnpayReturnMobile,
  checkPaymentStatus
} from "../../controllers/mobile/paymentMobileController.js";
import {
  createMoMoUrlMobile,
  momoReturnMobile,
  momoIPN
} from "../../controllers/mobile/momoMobileController.js";

const router = express.Router();

router.get("/return", vnpayReturnMobile);
router.post("/momo/create", mobileAuth, createMoMoUrlMobile);
router.get("/momo/return", momoReturnMobile);
router.post("/momo/ipn", momoIPN);


router.use(mobileAuth);
router.post("/create", createVNPayUrlMobile);
router.get("/status/:orderId", checkPaymentStatus);

export default router;