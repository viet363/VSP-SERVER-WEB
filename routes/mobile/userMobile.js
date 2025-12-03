import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import { 
  getUserMobile, 
  updateUserProfile, 
  updateUserWithAvatar,
  changePassword,
  upload 
} from "../../controllers/mobile/userMobileController.js";

const router = express.Router();

router.get("/profile", mobileAuth, getUserMobile);
router.put("/profile", mobileAuth, updateUserProfile);
router.post("/profile/avatar", mobileAuth, upload.single('avatar'), updateUserWithAvatar);
router.put("/password", mobileAuth, changePassword);

export default router;