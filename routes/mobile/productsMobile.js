import express from "express";
import {
  getProductListMobile,
  getProductDetailMobile,
  getProductSpecificationsMobile,
  searchProductsMobile 
} from "../../controllers/mobile/productsMobileController.js";

const router = express.Router();

router.get("/", getProductListMobile);
router.get("/:id", getProductDetailMobile);
router.get("/:id/specifications", getProductSpecificationsMobile);
router.get('/search', searchProductsMobile);
export default router;
