/**
 * PHTS System - Request Service
 *
 * Handles API calls for PTS request management
 */

import { apiClient } from '@/lib/axios';
import {
  PTSRequest,
  RequestWithDetails,
  CreateRequestDTO,
  RequestType,
} from '@/types/request.types';
import { ApiResponse } from '@/types/auth';

/**
 * Create a new PTS request
 */
export async function createRequest(
  data: CreateRequestDTO,
  files?: File[]
): Promise<RequestWithDetails> {
  try {
    const formData = new FormData();

    // Add all form fields
    formData.append('personnel_type', data.personnel_type);
    formData.append('position_number', data.position_number);
    if (data.department_group) formData.append('department_group', data.department_group);
    if (data.main_duty) formData.append('main_duty', data.main_duty);

    // Serialize work_attributes as JSON string
    formData.append('work_attributes', JSON.stringify(data.work_attributes));

    formData.append('request_type', data.request_type);
    if (data.requested_amount) formData.append('requested_amount', data.requested_amount.toString());
    if (data.effective_date) formData.append('effective_date', data.effective_date);

    // Append files if provided
    if (files && files.length > 0) {
      files.forEach((file) => {
        formData.append('files', file);
      });
    }

    const response = await apiClient.post<ApiResponse<RequestWithDetails>>(
      '/api/requests',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create request');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการสร้างคำขอ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Submit a draft request to start approval workflow
 */
export async function submitRequest(requestId: number): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${requestId}/submit`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to submit request');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการส่งคำขอ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Get all requests created by the current user
 */
export async function getMyRequests(): Promise<RequestWithDetails[]> {
  try {
    const response = await apiClient.get<ApiResponse<RequestWithDetails[]>>(
      '/api/requests'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch requests');
    }

    return response.data.data || [];
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Get pending requests for approval
 */
export async function getPendingRequests(): Promise<RequestWithDetails[]> {
  try {
    const response = await apiClient.get<ApiResponse<RequestWithDetails[]>>(
      '/api/requests/pending'
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch pending requests');
    }

    return response.data.data || [];
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอที่รออนุมัติ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Get request details by ID
 */
export async function getRequestById(id: number): Promise<RequestWithDetails> {
  try {
    const response = await apiClient.get<ApiResponse<RequestWithDetails>>(
      `/api/requests/${id}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch request details');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูลคำขอ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Approve a request
 */
export async function approveRequest(
  id: number,
  comment?: string
): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${id}/approve`,
      { comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to approve request');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการอนุมัติคำขอ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Reject a request
 */
export async function rejectRequest(
  id: number,
  comment: string
): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${id}/reject`,
      { comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to reject request');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}

/**
 * Return a request to previous step
 */
export async function returnRequest(
  id: number,
  comment: string
): Promise<PTSRequest> {
  try {
    const response = await apiClient.post<ApiResponse<PTSRequest>>(
      `/api/requests/${id}/return`,
      { comment }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to return request');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.error || 'เกิดข้อผิดพลาดในการส่งคำขอกลับ');
    }
    throw new Error('การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
  }
}
