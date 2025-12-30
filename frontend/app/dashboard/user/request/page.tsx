/**
 * PHTS System - User Request Page
 *
 * Page for creating new PTS requests
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stack,
  Snackbar,
  Alert,
} from '@mui/material';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import RequestForm from '@/components/requests/RequestForm';
import { CreateRequestDTO } from '@/types/request.types';
import * as requestService from '@/services/requestService';

export default function UserRequestPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleSubmit = async (
    data: CreateRequestDTO,
    files: File[]
  ) => {
    setIsSubmitting(true);
    try {
      // Create and submit request
      const request = await requestService.createRequest(data, files);

      // Automatically submit the request (move from DRAFT to PENDING)
      await requestService.submitRequest(request.request_id);

      // Show success message
      setToast({
        open: true,
        message: 'ส่งคำขอสำเร็จ! กำลังนำคุณไปยังหน้ารายการคำขอ...',
        severity: 'success',
      });

      // Redirect to user dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard/user');
      }, 2000);
    } catch (error: any) {
      setToast({
        open: true,
        message: error.message || 'เกิดข้อผิดพลาดในการส่งคำขอ',
        severity: 'error',
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard/user');
  };

  const handleCloseToast = () => {
    setToast({ ...toast, open: false });
  };

  return (
    <DashboardLayout title="ยื่นคำขอรับค่าตอบแทน พ.ต.ส.">
      <Stack spacing={3}>
        <RequestForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
        />
      </Stack>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
