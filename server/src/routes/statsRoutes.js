import express from 'express';
import { getGlobalVouchedCount } from '../services/communityService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const count = await getGlobalVouchedCount();
    res.json({ vouchedToday: count });
  } catch (err) {
    res.json({ vouchedToday: 1 });
  }
});

export default router;

