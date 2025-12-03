import express from "express";
import { mobileAuth } from "../../middlewares/mobileAuth.js";
import {
  getAddressMobile,
  addAddressMobile,
  deleteAddressMobile,
} from "../../controllers/mobile/addressMobileController.js";

const router = express.Router();

router.get("/", mobileAuth, getAddressMobile);
router.post("/", mobileAuth, addAddressMobile);
router.delete("/:id", mobileAuth, deleteAddressMobile);

export default router;
