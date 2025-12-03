import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import { getNotificationMobile } from "../../controllers/mobile/notificationMobileController.js";

const router = express.Router();
router.get("/", mobileAuth, getNotificationMobile);

export default router;
