import express from "express";
import { getRecommendedProducts } from "../../controllers/mobile/recommendMobileController.js";

const router = express.Router();

router.get("/:userId", getRecommendedProducts);

export default router;
