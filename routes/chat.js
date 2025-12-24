import express from 'express';
import { 
  getChatUsers, 
  getUserMessages,
  adminSendMessage,
  userSendMessage,
  getUnreadCount,
  markAllAsRead,
  getAdminInfo
} from '../controllers/chatController.js';

const router = express.Router();

router.get('/users', getChatUsers);
router.get('/user/:userId', getUserMessages);
router.post('/admin/send', adminSendMessage);
router.post('/user/send', userSendMessage);
router.get('/unread/:userId', getUnreadCount);
router.post('/mark-read', markAllAsRead);
router.get('/admin-info', getAdminInfo);

export default router;