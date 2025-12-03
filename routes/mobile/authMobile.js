import express from "express";
import {
  mobileLogin,
  mobileRegister,
  mobileLoginWithGoogle,
} from "../../controllers/mobile/authMobileController.js";

const router = express.Router();

router.post("/login", mobileLogin);
router.post("/login-google", mobileLoginWithGoogle);
router.post("/register", mobileRegister);

export default router;