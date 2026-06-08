import { Router } from 'express';
import { getSettings, updateSettings, registerToken, testNotification } from '../controllers/notifications.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all notification routes
router.use(authMiddleware);

router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/register-token', registerToken);
router.post('/test', testNotification);

export default router;
