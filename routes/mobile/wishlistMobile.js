import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import {
  getWishlistMobile,
  addWishlistMobile,
  deleteWishlistMobile,
} from "../../controllers/mobile/wishlistMobileController.js";

const router = express.Router();

router.get("/", mobileAuth, getWishlistMobile);
router.post("/", mobileAuth, addWishlistMobile);
router.delete("/:productId", mobileAuth, deleteWishlistMobile);

export default router;
