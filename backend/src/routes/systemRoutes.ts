import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { syncSystemData, getSyncStatus } from '../controllers/systemController.js';
import { UserRole } from '../types/auth.js';

const router = Router();

// POST /api/system/sync (admin only)
router.post('/sync', protect, restrictTo(UserRole.ADMIN), syncSystemData);
router.get('/sync/status', protect, restrictTo(UserRole.ADMIN), getSyncStatus);

export default router;
