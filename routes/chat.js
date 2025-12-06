import express from 'express';
import { verifyAdmin } from "../middlewares/verifyAdmin.js";
import { 
  getChatUsers, 
  getUserMessages,
  adminSendMessage 
} from '../controllers/chatController.js';

const router = express.Router();

router.get('/users', verifyAdmin, getChatUsers);
router.get('/user/:userId', verifyAdmin, getUserMessages);
router.post('/admin/send', verifyAdmin, adminSendMessage);

export default router;
