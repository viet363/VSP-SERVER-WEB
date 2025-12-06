import express from "express";
import {
  getProductReviews,
  getUserReviews,
  createReview,
  updateReview,
  deleteReview,
  getProductRatingStats
} from "../../controllers/mobile/productReviewController.js";
import { mobileAuth } from "../../middlewares/mobileAuth.js";

const router = express.Router();

router.get("/product/:productId", getProductReviews);
router.get("/product/:productId/stats", getProductRatingStats);

router.get("/user", mobileAuth, getUserReviews);
router.post("/", mobileAuth, createReview);
router.put("/:reviewId", mobileAuth, updateReview);
router.delete("/:reviewId", mobileAuth, deleteReview);

export default router;
