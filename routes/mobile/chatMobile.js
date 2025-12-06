import express from 'express';
import mobileAuth from '../../middlewares/mobileAuth.js';
import {
  getChatWithFirstAdmin,
  getChatWithAdmin,
  sendMessage,
  getAdminsList,
  getFirstAdmin,
  getUnreadCount,
  getUpdates
} from '../../controllers/mobile/mobileChatController.js';

const router = express.Router();
router.get('/admins/list', mobileAuth, getAdminsList);
router.get('/admin/first', mobileAuth, getFirstAdmin);
router.get('/unread/count', mobileAuth, getUnreadCount);
router.get('/updates', mobileAuth, getUpdates);
router.get('/', mobileAuth, getChatWithFirstAdmin);
router.get('/:adminId', mobileAuth, getChatWithAdmin);
router.post('/', mobileAuth, sendMessage);


export default router;