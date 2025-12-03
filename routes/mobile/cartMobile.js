import express from "express";
import {
  getCartMobile,
  addToCartMobile,
  updateCartMobile,
  deleteCartItemMobile,
} from "../../controllers/mobile/cartMobileController.js";
import { mobileAuth } from "../../middlewares/mobileAuth.js";

const router = express.Router();

router.get("/", mobileAuth, getCartMobile);
router.post("/", mobileAuth, addToCartMobile);
router.put("/:id", mobileAuth, updateCartMobile);
router.delete("/:id", mobileAuth, deleteCartItemMobile);


export default router;
