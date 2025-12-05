import express from "express";
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory ,
  searchCategoriesAdvanced
} from "../controllers/categoriesController.js";

const router = express.Router();

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);
router.get("/search", searchCategoriesAdvanced);
export default router;