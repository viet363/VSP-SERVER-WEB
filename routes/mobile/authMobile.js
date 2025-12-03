import express from "express";
import {
  mobileLogin,
  mobileRegister,
  mobileLoginWithGoogle,
  debugGoogleToken,
  mobileLoginWithGoogleDev
} from "../../controllers/mobile/authMobileController.js";

const router = express.Router();

router.post("/login", mobileLogin);
router.post("/login-google", mobileLoginWithGoogle);
router.post("/register", mobileRegister);
router.post("/debug-google-token", debugGoogleToken);
router.post("/login-google-dev", mobileLoginWithGoogleDev);

export default router;