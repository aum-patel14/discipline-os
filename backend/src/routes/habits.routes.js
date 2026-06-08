import { Router } from 'express';
import { getHabits, createHabit, updateHabit, deleteHabit, reorderHabits, resetGoals } from '../controllers/habits.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all habits routes
router.use(authMiddleware);

router.get('/', getHabits);
router.post('/', createHabit);
router.put('/reorder', reorderHabits);
router.post('/reset-goals', resetGoals);
router.put('/:id', updateHabit);
router.delete('/:id', deleteHabit);

export default router;
