import express from "express";
import {
    getSpecByCategory,
    getSpecByProduct,
    saveProductSpecs,
} from "../controllers/specController.js";

const router = express.Router();

router.use((req, res, next) => {
    console.log(`Spec Route: ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/category/:categoryId", getSpecByCategory);

router.get("/product/:productId", getSpecByProduct);

router.post("/products/:productId/specs", saveProductSpecs);

export default router;