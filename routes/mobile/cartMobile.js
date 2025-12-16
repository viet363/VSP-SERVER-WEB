import express from 'express';
import { mobileAuth } from '../../middlewares/mobileAuth.js';
import {
  getCartMobile,
  addToCartMobile,
  updateCartMobile,
  deleteCartItemMobile
} from '../../controllers/mobile/cartMobileController.js';

const router = express.Router();

router.use(mobileAuth);

router.get('/', getCartMobile);
router.post('/add', addToCartMobile);
router.put('/:id', updateCartMobile);
router.delete('/:id', deleteCartItemMobile);

export default router;