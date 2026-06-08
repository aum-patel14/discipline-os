import { Router } from 'express';
import { 
  getMonthlyScore, 
  getWeeklyScore, 
  getStreaks, 
  getEnergyScoreToday, 
  getBestHabits, 
  getHeatmap 
} from '../controllers/analytics.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all analytics routes
router.use(authMiddleware);

router.get('/monthly/:year/:month', getMonthlyScore);
router.get('/weekly', getWeeklyScore);
router.get('/streak', getStreaks);
router.get('/energy/today', getEnergyScoreToday);
router.get('/best-habits', getBestHabits);
router.get('/heatmap', getHeatmap);

export default router;
