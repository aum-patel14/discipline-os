import { Router } from 'express';
import { getCurrentChallenge, startChallenge, markDay, resetChallenge, getChallengeHistory } from '../controllers/challenge.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all challenge routes
router.use(authMiddleware);

router.get('/current', getCurrentChallenge);
router.post('/start', startChallenge);
router.post('/mark-day', markDay);
router.post('/reset', resetChallenge);
router.get('/history', getChallengeHistory);

export default router;
