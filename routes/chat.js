import express from 'express';
import { 
  getChatUsers, 
  getUserMessages,
  adminSendMessage 
} from '../controllers/chatController.js';

const router = express.Router();

router.get('/users', getChatUsers);
router.get('/user/:userId', getUserMessages);
router.post('/admin/send', adminSendMessage);

export default router;