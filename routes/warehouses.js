import express from "express";
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from "../controllers/warehousesController.js";
const router = express.Router();
router.get("/", getWarehouses);
router.post("/", createWarehouse);
router.put("/:id", updateWarehouse);
router.delete("/:id", deleteWarehouse);
export default router;
