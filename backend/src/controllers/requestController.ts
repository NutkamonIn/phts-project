/**
 * PHTS System - Request Controller
 *
 * HTTP handlers for PTS request management endpoints
 *
 * Date: 2025-12-30
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../types/auth.js';
import {
  RequestType,
  PTSRequest,
  RequestWithDetails,
  PersonnelType,
  CreateRequestDTO,
  BatchApproveResult,
} from '../types/request.types.js';
import * as requestService from '../services/requestService.js';
import { handleUploadError } from '../config/upload.js';

/**
 * Create a new PTS request
 *
 * @route POST /api/requests
 * @access Protected
 */
export async function createRequest(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const {
      personnel_type,
      position_number,
      department_group,
      main_duty,
      work_attributes,
      request_type,
      requested_amount,
      effective_date,
      submission_data,
    } = req.body;

    // Validate required fields
    if (!personnel_type || !request_type) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: personnel_type and request_type',
      });
      return;
    }

    // Validate personnel_type is valid enum value
    if (!Object.values(PersonnelType).includes(personnel_type)) {
      res.status(400).json({
        success: false,
        error: `Invalid personnel_type. Must be one of: ${Object.values(PersonnelType).join(', ')}`,
      });
      return;
    }

    // Validate request_type is valid enum value
    if (!Object.values(RequestType).includes(request_type)) {
      res.status(400).json({
        success: false,
        error: `Invalid request_type. Must be one of: ${Object.values(RequestType).join(', ')}`,
      });
      return;
    }

    // Parse work_attributes if it's a string
    let parsedWorkAttributes;
    if (work_attributes) {
      try {
        parsedWorkAttributes = typeof work_attributes === 'string'
          ? JSON.parse(work_attributes)
          : work_attributes;
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid work_attributes format. Must be valid JSON.',
        });
        return;
      }
    }

    // Parse submission_data if it's a string (for backward compatibility)
    let parsedSubmissionData;
    if (submission_data) {
      try {
        parsedSubmissionData = typeof submission_data === 'string'
          ? JSON.parse(submission_data)
          : submission_data;
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid submission_data format. Must be valid JSON.',
        });
        return;
      }
    }

    // Build DTO
    const requestData: CreateRequestDTO = {
      personnel_type: personnel_type as PersonnelType,
      position_number,
      department_group,
      main_duty,
      work_attributes: parsedWorkAttributes,
      request_type: request_type as RequestType,
      requested_amount: requested_amount ? parseFloat(requested_amount) : undefined,
      effective_date,
      submission_data: parsedSubmissionData,
    };

    // Get uploaded files
    const files = req.files as Express.Multer.File[] | undefined;

    // Create request
    const request = await requestService.createRequest(
      req.user.userId,
      requestData,
      files
    );

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created successfully',
    });
  } catch (error: any) {
    console.error('Create request error:', error);

    // Handle file upload errors
    const uploadError = handleUploadError(error);
    if (uploadError !== 'An error occurred during file upload') {
      res.status(400).json({
        success: false,
        error: uploadError,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while creating the request',
    });
  }
}

/**
 * Submit a draft request to start approval workflow
 *
 * @route POST /api/requests/:id/submit
 * @access Protected
 */
export async function submitRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const request = await requestService.submitRequest(requestId, req.user.userId);

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request submitted successfully',
    });
  } catch (error: any) {
    console.error('Submit request error:', error);

    const statusCode = error.message.includes('not found') || error.message.includes('permission')
      ? 404
      : error.message.includes('Cannot submit')
      ? 400
      : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while submitting the request',
    });
  }
}

/**
 * Get all requests created by the current user
 *
 * @route GET /api/requests
 * @access Protected
 */
export async function getMyRequests(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails[]>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requests = await requestService.getMyRequests(req.user.userId);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while fetching your requests',
    });
  }
}

/**
 * Get pending requests for approval by current user's role
 *
 * @route GET /api/requests/pending
 * @access Protected (Approvers only)
 */
export async function getPendingApprovals(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails[]>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requests = await requestService.getPendingForApprover(req.user.role);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('Get pending approvals error:', error);

    const statusCode = error.message.includes('Invalid approver role') ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while fetching pending approvals',
    });
  }
}

/**
 * Get request details by ID
 *
 * @route GET /api/requests/:id
 * @access Protected
 */
export async function getRequestById(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const request = await requestService.getRequestById(
      requestId,
      req.user.userId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    console.error('Get request by ID error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('permission')
      ? 403
      : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while fetching the request',
    });
  }
}

/**
 * Approve a request
 *
 * @route POST /api/requests/:id/approve
 * @access Protected (Approvers only)
 */
export async function approveRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;

    const request = await requestService.approveRequest(
      requestId,
      req.user.userId,
      req.user.role,
      comment
    );

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request approved successfully',
    });
  } catch (error: any) {
    console.error('Approve request error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid approver') || error.message.includes('Cannot approve')
      ? 403
      : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while approving the request',
    });
  }
}

/**
 * Reject a request
 *
 * @route POST /api/requests/:id/reject
 * @access Protected (Approvers only)
 */
export async function rejectRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Rejection reason (comment) is required',
      });
      return;
    }

    const request = await requestService.rejectRequest(
      requestId,
      req.user.userId,
      req.user.role,
      comment
    );

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request rejected successfully',
    });
  } catch (error: any) {
    console.error('Reject request error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid approver') || error.message.includes('Cannot reject')
      ? 403
      : error.message.includes('required')
      ? 400
      : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while rejecting the request',
    });
  }
}

/**
 * Return a request to previous step
 *
 * @route POST /api/requests/:id/return
 * @access Protected (Approvers only)
 */
export async function returnRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Return reason (comment) is required',
      });
      return;
    }

    const request = await requestService.returnRequest(
      requestId,
      req.user.userId,
      req.user.role,
      comment
    );

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request returned to previous step successfully',
    });
  } catch (error: any) {
    console.error('Return request error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid approver') || error.message.includes('Cannot return')
      ? 403
      : error.message.includes('required')
      ? 400
      : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while returning the request',
    });
  }
}

/**
 * Batch approve multiple requests (DIRECTOR only)
 *
 * @route POST /api/requests/batch-approve
 * @access Protected (DIRECTOR only)
 */
export async function approveBatch(
  req: Request,
  res: Response<ApiResponse<BatchApproveResult>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    // Validate user is DIRECTOR
    if (req.user.role !== 'DIRECTOR') {
      res.status(403).json({
        success: false,
        error: 'Only DIRECTOR can perform batch approval',
      });
      return;
    }

    const { requestIds, comment } = req.body;

    // Validate requestIds is array
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'requestIds must be a non-empty array',
      });
      return;
    }

    // Validate all requestIds are numbers
    const invalidIds = requestIds.filter((id) => typeof id !== 'number' || isNaN(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        error: 'All requestIds must be valid numbers',
      });
      return;
    }

    const result = await requestService.approveBatch(req.user.userId, {
      requestIds,
      comment,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Batch approval completed: ${result.success.length} approved, ${result.failed.length} failed`,
    });
  } catch (error: any) {
    console.error('Batch approval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during batch approval',
    });
  }
}
