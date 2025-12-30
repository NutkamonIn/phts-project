/**
 * PHTS System - Request Routes
 *
 * API routes for PTS request management and workflow
 *
 * Date: 2025-12-30
 */

import { Router } from 'express';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import { upload } from '../config/upload.js';
import * as requestController from '../controllers/requestController.js';
import { UserRole } from '../types/auth.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Batch Approval Route
 * DIRECTOR only - must be before /:id routes to avoid conflicts
 */
router.post(
  '/batch-approve',
  restrictTo(UserRole.DIRECTOR),
  requestController.approveBatch
);

/**
 * User Routes
 * Available to all authenticated users
 */

// Create new request with file uploads
router.post(
  '/',
  upload.array('files', 10),
  requestController.createRequest
);

// Get current user's requests
router.get(
  '/',
  requestController.getMyRequests
);

// Get request details by ID
router.get(
  '/:id',
  requestController.getRequestById
);

// Submit a draft request
router.post(
  '/:id/submit',
  requestController.submitRequest
);

/**
 * Approver Routes
 * Restricted to users with approval roles
 */

// Get pending requests for approval (based on user's role)
router.get(
  '/pending',
  restrictTo(
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE
  ),
  requestController.getPendingApprovals
);

// Approve a request
router.post(
  '/:id/approve',
  restrictTo(
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE
  ),
  requestController.approveRequest
);

// Reject a request
router.post(
  '/:id/reject',
  restrictTo(
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE
  ),
  requestController.rejectRequest
);

// Return a request to previous step
router.post(
  '/:id/return',
  restrictTo(
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.DIRECTOR,
    UserRole.HEAD_FINANCE
  ),
  requestController.returnRequest
);

export default router;
