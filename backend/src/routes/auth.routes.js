import { Router } from 'express';
import { signup, login, googleLogin, logout, getMe, updateProfile } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Public routes (rate limited)
router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.post('/logout', logout);

// Authenticated routes
router.get('/me', authMiddleware, getMe);
router.put('/profile', authMiddleware, updateProfile);

export default router;
