import express from "express";
import {
  getProductListMobile,
  getProductDetailMobile,
  getProductSpecificationsMobile,
  searchProductsMobile,
  getProductByCategoryMobile,
  filterProductsMobile 
} from "../../controllers/mobile/productsMobileController.js";

const router = express.Router();

router.get("/", getProductListMobile);
router.get("/search", searchProductsMobile);
router.get("/category/:id", getProductByCategoryMobile);  
router.get("/:id/specifications", getProductSpecificationsMobile);
router.get("/:id", getProductDetailMobile);
router.post('/filter', filterProductsMobile);



export default router;
