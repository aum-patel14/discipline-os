import { Router } from 'express';
import { 
  getTodayProgress, 
  getProgressByDate, 
  getMonthProgress, 
  getProgressRange, 
  logProgress, 
  toggleProgress, 
  resetTodayProgress 
} from '../controllers/progress.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all progress routes
router.use(authMiddleware);

router.get('/today', getTodayProgress);
router.get('/date/:date', getProgressByDate);
router.get('/month/:year/:month', getMonthProgress);
router.get('/range', getProgressRange);
router.post('/log', logProgress);
router.post('/toggle', toggleProgress);
router.delete('/reset-today', resetTodayProgress);

export default router;
