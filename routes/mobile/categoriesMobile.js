import express from "express";
import { getCategoriesMobile } from "../../controllers/mobile/categoriesMobileController.js";

const router = express.Router();
router.get("/", getCategoriesMobile);

export default router;
