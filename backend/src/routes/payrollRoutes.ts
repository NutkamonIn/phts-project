import { Router } from 'express';
import {
  approveByDirector,
  approveByHR,
  calculatePeriod,
  getPeriodStatus,
  rejectPeriod,
  submitToHR,
} from '../controllers/payrollController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { UserRole } from '../types/auth.js';

const router = Router();

// View period status (authenticated dashboard users)
router.get('/period', protect, getPeriodStatus);

// Calculate (OFFICER/ADMIN)
router.post(
  '/period/:periodId/calculate',
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  calculatePeriod,
);

// Submit to HR (OFFICER/ADMIN)
router.post(
  '/period/:periodId/submit',
  protect,
  restrictTo(UserRole.PTS_OFFICER, UserRole.ADMIN),
  submitToHR,
);

// Approve by HR
router.post(
  '/period/:periodId/approve-hr',
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.ADMIN),
  approveByHR,
);

// Approve by Director
router.post(
  '/period/:periodId/approve-director',
  protect,
  restrictTo(UserRole.DIRECTOR, UserRole.ADMIN),
  approveByDirector,
);

// Reject (HR/Director/Admin)
router.post(
  '/period/:periodId/reject',
  protect,
  restrictTo(UserRole.HEAD_HR, UserRole.DIRECTOR, UserRole.ADMIN),
  rejectPeriod,
);

export default router;
