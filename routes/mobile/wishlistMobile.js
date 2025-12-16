import express from 'express';
import {
  addToWishlist,
  removeFromWishlist,
  getUserWishlist,
  checkWishlist
} from '../../controllers/mobile/wishlistMobileController.js';
import { mobileAuth } from '../../middlewares/mobileAuth.js';

const router = express.Router();

router.post('/add/:productId', mobileAuth, addToWishlist);
router.delete('/remove/:productId', mobileAuth, removeFromWishlist);
router.get('/', mobileAuth, getUserWishlist);
router.get('/check/:productId', mobileAuth, checkWishlist);

export default router;