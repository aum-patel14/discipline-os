import { Router } from 'express';
import { 
  connectPartner, 
  listPartners, 
  updatePartnershipStatus, 
  deletePartner, 
  verifyPartner, 
  getPartnerProgress, 
  getLeaderboard 
} from '../controllers/partners.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = Router();

// Secure all partnership routes
router.use(authMiddleware);

router.post('/connect', connectPartner);
router.get('/list', listPartners);
router.put('/:id/status', updatePartnershipStatus); // Accept/Decline pending requests
router.delete('/:id', deletePartner);
router.post('/verify', verifyPartner);
router.get('/:id/progress', getPartnerProgress);
router.get('/leaderboard', getLeaderboard);

export default router;
