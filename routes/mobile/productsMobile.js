import express from "express";
import {
  getProductListMobile,
  getProductDetailMobile,
  getProductSpecificationsMobile,
  searchProductsMobile 
} from "../../controllers/mobile/productsMobileController.js";

const router = express.Router();

router.get("/", getProductListMobile);
router.get("/search", searchProductsMobile);
router.get("/:id/specifications", getProductSpecificationsMobile);
router.get("/:id", getProductDetailMobile);
export default router;
