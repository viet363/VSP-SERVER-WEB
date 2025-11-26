import express from "express";
import { getInventory, importStock, exportStock, getInventoryLog } from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/", getInventory);
router.post("/import", importStock);
router.post("/export", exportStock);
router.get("/log", getInventoryLog);

export default router;