import { Router } from 'express';
import { getTodayMood, getMoodHistory, logMood, getCorrelation } from '../controllers/mood.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all mood routes
router.use(authMiddleware);

router.get('/today', getTodayMood);
router.get('/history', getMoodHistory);
router.post('/log', logMood);
router.get('/correlation', getCorrelation);

export default router;
