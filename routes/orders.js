import express from "express";
import { 
  getOrders, 
  getOrderById, 
  createOrder, 
  updateOrderStatus 
} from "../controllers/ordersController.js";

const router = express.Router();

router.get("/", getOrders);
router.get("/:id", getOrderById);
router.post("/", createOrder);
router.put("/:id", updateOrderStatus);

export default router;