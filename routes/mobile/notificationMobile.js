import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import { getNotificationsMobile } from "../../controllers/mobile/notificationMobileController.js";

const router = express.Router();
router.get("/", mobileAuth, getNotificationsMobile);

export default router;
