/**
 * PHTS System - Request Form Component
 *
 * Form for creating new PTS requests matching official Thai government P.T.S. form structure
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Divider,
  CircularProgress,
  Alert,
  Box,
  Stack,
  Checkbox,
  FormGroup,
  InputAdornment,
  FormHelperText,
} from '@mui/material';
import { Send, RestartAlt } from '@mui/icons-material';
import {
  PersonnelType,
  PERSONNEL_TYPE_LABELS,
  RequestType,
  REQUEST_TYPE_LABELS,
  WorkAttributes,
  WORK_ATTRIBUTE_LABELS,
  CreateRequestDTO,
} from '@/types/request.types';
import FileUploadArea from './FileUploadArea';
import { AuthService } from '@/services/authService';

interface RequestFormProps {
  onSubmit: (data: CreateRequestDTO, files: File[]) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

interface UserInfo {
  name: string;
  position: string;
  department: string;
  citizenId: string;
  ptsRate?: number;
}

export default function RequestForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
}: RequestFormProps) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Form fields
  const [personnelType, setPersonnelType] = useState<PersonnelType | ''>('');
  const [positionNumber, setPositionNumber] = useState('');
  const [departmentGroup, setDepartmentGroup] = useState('');
  const [mainDuty, setMainDuty] = useState('');
  const [workAttributes, setWorkAttributes] = useState<WorkAttributes>({
    operation: false,
    planning: false,
    coordination: false,
    service: false,
  });
  const [requestType, setRequestType] = useState<RequestType | ''>('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch user info on mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoadingUser(true);
        const currentUser = AuthService.getCurrentUser();

        if (!currentUser) {
          setError('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
          return;
        }

        // Mock user data - In production, fetch from /api/users/me or similar
        setUserInfo({
          name: 'ผู้ใช้ระบบ',
          position: 'ตำแหน่ง',
          department: 'แผนก',
          citizenId: currentUser.citizen_id,
          ptsRate: 0,
        });
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้');
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserInfo();
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Personnel type is required
    if (!personnelType) {
      errors.personnelType = 'กรุณาเลือกประเภทบุคลากร';
    }

    // Position number is required
    if (!positionNumber.trim()) {
      errors.positionNumber = 'กรุณากรอกเลขที่ตำแหน่ง';
    }

    // Work attributes - at least one must be checked
    const hasWorkAttribute = Object.values(workAttributes).some(val => val === true);
    if (!hasWorkAttribute) {
      errors.workAttributes = 'กรุณาเลือกลักษณะงานอย่างน้อย 1 ข้อ';
    }

    // Request type is required
    if (!requestType) {
      errors.requestType = 'กรุณาเลือกประเภทคำขอ';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    // Validate form
    if (!validateForm()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const formData: CreateRequestDTO = {
        personnel_type: personnelType as PersonnelType,
        position_number: positionNumber.trim(),
        department_group: departmentGroup.trim() || undefined,
        main_duty: mainDuty.trim() || undefined,
        work_attributes: workAttributes,
        request_type: requestType as RequestType,
        requested_amount: requestedAmount ? parseFloat(requestedAmount) : undefined,
        effective_date: effectiveDate || undefined,
      };

      await onSubmit(formData, files);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการส่งคำขอ');
    }
  };

  const handleReset = () => {
    setPersonnelType('');
    setPositionNumber('');
    setDepartmentGroup('');
    setMainDuty('');
    setWorkAttributes({
      operation: false,
      planning: false,
      coordination: false,
      service: false,
    });
    setRequestType('');
    setRequestedAmount('');
    setEffectiveDate('');
    setFiles([]);
    setError(null);
    setValidationErrors({});
  };

  const handleWorkAttributeChange = (key: keyof WorkAttributes) => {
    setWorkAttributes(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loadingUser) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!userInfo) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            ไม่สามารถโหลดข้อมูลผู้ใช้ได้ กรุณาเข้าสู่ระบบใหม่
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent sx={{ p: 4 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={4}>
            {/* Form Title */}
            <Box>
              <Typography variant="h4" fontWeight={700} color="primary" gutterBottom>
                แบบฟอร์มขอรับค่าตอบแทน พ.ต.ส.
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                P.T.S. Allowance Request Form
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Divider />

            {/* Section 1: Personnel Type */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 1, mb: 2 }}
              >
                ส่วนที่ 1: ประเภทบุคลากร
              </Typography>
              <FormControl component="fieldset" error={!!validationErrors.personnelType}>
                <RadioGroup
                  row
                  value={personnelType}
                  onChange={(e) => setPersonnelType(e.target.value as PersonnelType)}
                >
                  {Object.entries(PERSONNEL_TYPE_LABELS).map(([key, label]) => (
                    <FormControlLabel
                      key={key}
                      value={key}
                      control={<Radio />}
                      label={label}
                      disabled={isSubmitting}
                    />
                  ))}
                </RadioGroup>
                {validationErrors.personnelType && (
                  <FormHelperText>{validationErrors.personnelType}</FormHelperText>
                )}
              </FormControl>
            </Box>

            <Divider />

            {/* Section 2: Personal Information */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 1, mb: 2 }}
              >
                ส่วนที่ 2: ข้อมูลส่วนตัว
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 3,
                }}
              >
                <TextField
                  fullWidth
                  label="ชื่อ-นามสกุล"
                  value={userInfo.name}
                  disabled
                  slotProps={{
                    input: {
                      readOnly: true,
                    },
                  }}
                  sx={{ bgcolor: 'grey.50' }}
                />
                <TextField
                  fullWidth
                  label="ตำแหน่ง"
                  value={userInfo.position}
                  disabled
                  slotProps={{
                    input: {
                      readOnly: true,
                    },
                  }}
                  sx={{ bgcolor: 'grey.50' }}
                />
                <TextField
                  fullWidth
                  required
                  label="เลขที่ตำแหน่ง"
                  value={positionNumber}
                  onChange={(e) => setPositionNumber(e.target.value)}
                  disabled={isSubmitting}
                  error={!!validationErrors.positionNumber}
                  helperText={validationErrors.positionNumber}
                  placeholder="กรอกเลขที่ตำแหน่ง"
                />
                <TextField
                  fullWidth
                  label="กลุ่มงาน/แผนก"
                  value={departmentGroup}
                  onChange={(e) => setDepartmentGroup(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="กรอกกลุ่มงาน/แผนก (ถ้ามี)"
                />
                <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                  <TextField
                    fullWidth
                    label="หน้าที่หลัก"
                    value={mainDuty}
                    onChange={(e) => setMainDuty(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="ระบุหน้าที่หลักในการปฏิบัติงาน"
                    multiline
                    rows={2}
                  />
                </Box>
              </Box>
            </Box>

            <Divider />

            {/* Section 3: Work Attributes */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 1, mb: 2 }}
              >
                ส่วนที่ 3: ลักษณะงาน (เลือกอย่างน้อย 1 ข้อ)
              </Typography>
              <FormControl component="fieldset" error={!!validationErrors.workAttributes}>
                <FormGroup row>
                  {Object.entries(WORK_ATTRIBUTE_LABELS).map(([key, label]) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <Checkbox
                          checked={workAttributes[key as keyof WorkAttributes]}
                          onChange={() => handleWorkAttributeChange(key as keyof WorkAttributes)}
                          disabled={isSubmitting}
                        />
                      }
                      label={label}
                    />
                  ))}
                </FormGroup>
                {validationErrors.workAttributes && (
                  <FormHelperText>{validationErrors.workAttributes}</FormHelperText>
                )}
              </FormControl>
            </Box>

            <Divider />

            {/* Section 4: Request Type */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 1, mb: 2 }}
              >
                ส่วนที่ 4: ประเภทคำขอ
              </Typography>
              <FormControl component="fieldset" error={!!validationErrors.requestType}>
                <RadioGroup
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as RequestType)}
                >
                  {Object.entries(REQUEST_TYPE_LABELS).map(([key, label]) => (
                    <FormControlLabel
                      key={key}
                      value={key}
                      control={<Radio />}
                      label={label}
                      disabled={isSubmitting}
                    />
                  ))}
                </RadioGroup>
                {validationErrors.requestType && (
                  <FormHelperText>{validationErrors.requestType}</FormHelperText>
                )}
              </FormControl>
            </Box>

            <Divider />

            {/* Section 5: Request Details */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 1, mb: 2 }}
              >
                ส่วนที่ 5: รายละเอียดการขอ
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 3,
                }}
              >
                <TextField
                  fullWidth
                  label="ยอดเงินที่ขอ"
                  type="number"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="กรอกจำนวนเงิน"
                  slotProps={{
                    input: {
                      endAdornment: <InputAdornment position="end">บาท</InputAdornment>,
                    },
                  }}
                />
                <TextField
                  fullWidth
                  label="วันที่มีผล"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  disabled={isSubmitting}
                  slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                  }}
                />
              </Box>
            </Box>

            <Divider />

            {/* Section 6: File Attachments */}
            <Box>
              <Typography
                variant="h6"
                gutterBottom
                fontWeight={600}
                sx={{ borderBottom: '2px solid', borderColor: 'primary.main', pb: 1, mb: 2 }}
              >
                ส่วนที่ 6: เอกสารแนบ
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                แนบเอกสารประกอบคำขอ เช่น ใบประกอบวิชาชีพ, ใบปริญญา, คำสั่ง, ฯลฯ
              </Typography>
              <FileUploadArea
                files={files}
                onChange={setFiles}
                maxFiles={5}
                maxSizeMB={10}
              />
            </Box>

            <Divider />

            {/* Warning Alert */}
            <Alert severity="warning" icon="⚠️">
              <Typography variant="body2" fontWeight={600} gutterBottom>
                คำเตือน
              </Typography>
              <Typography variant="body2">
                กรณีเปลี่ยนแปลงการปฏิบัติงาน หากข้อมูลไม่ตรงตามความเป็นจริง
                อาจมีความผิดตามประมวลกฎหมายอาญา มาตรา 137 หรือมาตรา 267
              </Typography>
            </Alert>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              {onCancel && (
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  size="large"
                >
                  ยกเลิก
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<RestartAlt />}
                onClick={handleReset}
                disabled={isSubmitting}
                size="large"
              >
                ล้างฟอร์ม
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
                disabled={isSubmitting}
                size="large"
              >
                {isSubmitting ? 'กำลังยื่นคำขอ...' : 'ยื่นคำขอ'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
