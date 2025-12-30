/**
 * PHTS System - Request Management Types (Frontend)
 *
 * Type definitions for PTS request workflow and management
 * Mirrors backend types for type safety across the stack
 */

/**
 * Personnel type classification for Thai hospital staff
 */
export enum PersonnelType {
  CIVIL_SERVANT = 'CIVIL_SERVANT',
  GOV_EMPLOYEE = 'GOV_EMPLOYEE',
  PH_EMPLOYEE = 'PH_EMPLOYEE',
  TEMP_EMPLOYEE = 'TEMP_EMPLOYEE',
}

/**
 * Personnel Type Labels (Thai)
 */
export const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  [PersonnelType.CIVIL_SERVANT]: 'ข้าราชการ',
  [PersonnelType.GOV_EMPLOYEE]: 'พนักงานราชการ',
  [PersonnelType.PH_EMPLOYEE]: 'พนักงานกระทรวงสาธารณสุข (พกส.)',
  [PersonnelType.TEMP_EMPLOYEE]: 'ลูกจ้างชั่วคราว',
};

/**
 * Request types for different PTS operations
 */
export enum RequestType {
  NEW_ENTRY = 'NEW_ENTRY',
  EDIT_INFO_SAME_RATE = 'EDIT_INFO_SAME_RATE',
  EDIT_INFO_NEW_RATE = 'EDIT_INFO_NEW_RATE',
}

/**
 * Request status tracking throughout the workflow
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

/**
 * Action types for request workflow transitions
 */
export enum ActionType {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN = 'RETURN',
}

/**
 * File attachment types for request documentation
 */
export enum FileType {
  LICENSE = 'LICENSE',
  DIPLOMA = 'DIPLOMA',
  ORDER_DOC = 'ORDER_DOC',
  OTHER = 'OTHER',
}

/**
 * Step to Role mapping
 */
export const STEP_ROLE_MAP: Record<number, string> = {
  1: 'HEAD_DEPT',
  2: 'PTS_OFFICER',
  3: 'HEAD_HR',
  4: 'DIRECTOR',
  5: 'HEAD_FINANCE',
};

/**
 * Role to Step mapping
 */
export const ROLE_STEP_MAP: Record<string, number> = {
  HEAD_DEPT: 1,
  PTS_OFFICER: 2,
  HEAD_HR: 3,
  DIRECTOR: 4,
  HEAD_FINANCE: 5,
};

/**
 * Work attributes interface for P.T.S. form
 * Represents the 4 checkboxes for work characteristics
 */
export interface WorkAttributes {
  operation: boolean;      // ปฏิบัติการ
  planning: boolean;       // วางแผน
  coordination: boolean;   // ประสานงาน
  service: boolean;        // บริการ
}

/**
 * Work Attribute Labels (Thai)
 */
export const WORK_ATTRIBUTE_LABELS = {
  operation: 'ปฏิบัติการ',
  planning: 'วางแผน',
  coordination: 'ประสานงาน',
  service: 'บริการ',
};

/**
 * PTS Request entity
 */
export interface PTSRequest {
  request_id: number;
  user_id: number;

  // Personnel Info (new fields from P.T.S. form)
  personnel_type: PersonnelType;
  position_number: string | null;
  department_group: string | null;
  main_duty: string | null;
  work_attributes: WorkAttributes | null;

  // Request Details
  request_type: RequestType;
  requested_amount: number | null;
  effective_date: string | null;

  // Workflow
  status: RequestStatus;
  current_step: number;
  submission_data: any;

  // Timestamps
  created_at: Date | string;
  updated_at: Date | string;
  submitted_at: Date | string | null;
}

/**
 * Request action/history entity
 */
export interface RequestAction {
  action_id: number;
  request_id: number;
  actor_id: number;
  action_type: ActionType;
  from_step: number;
  to_step: number;
  comment: string | null;
  created_at: Date | string;
}

/**
 * File attachment entity
 */
export interface RequestAttachment {
  attachment_id: number;
  request_id: number;
  file_type: FileType;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date | string;
}

/**
 * Extended request with related data
 */
export interface RequestWithDetails extends PTSRequest {
  attachments?: RequestAttachment[];
  actions?: RequestActionWithActor[];
  requester?: {
    citizen_id: string;
    role: string;
  };
}

/**
 * Action with actor information
 */
export interface RequestActionWithActor extends RequestAction {
  actor?: {
    citizen_id: string;
    role: string;
  };
}

/**
 * DTO for creating a new request
 */
export interface CreateRequestDTO {
  // Personnel Info
  personnel_type: PersonnelType;
  position_number: string;
  department_group?: string;
  main_duty?: string;
  work_attributes: WorkAttributes;

  // Request Details
  request_type: RequestType;
  requested_amount?: number;
  effective_date?: string;
}

/**
 * Request type labels (Thai)
 */
export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.NEW_ENTRY]: 'ขอรับค่าตอบแทนใหม่',
  [RequestType.EDIT_INFO_SAME_RATE]: 'แก้ไขข้อมูล (อัตราเดิม)',
  [RequestType.EDIT_INFO_NEW_RATE]: 'แก้ไขข้อมูล (อัตราใหม่)',
};

/**
 * Request status labels (Thai)
 */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.DRAFT]: 'แบบร่าง',
  [RequestStatus.PENDING]: 'รอดำเนินการ',
  [RequestStatus.APPROVED]: 'อนุมัติแล้ว',
  [RequestStatus.REJECTED]: 'ไม่อนุมัติ',
  [RequestStatus.CANCELLED]: 'ยกเลิก',
  [RequestStatus.RETURNED]: 'ส่งกลับแก้ไข',
};

/**
 * Step labels (Thai)
 */
export const STEP_LABELS: Record<number, string> = {
  1: 'หัวหน้าแผนก',
  2: 'เจ้าหน้าที่ พ.ต.ส.',
  3: 'หัวหน้าฝ่ายทรัพยากรบุคคล',
  4: 'ผู้อำนวยการโรงพยาบาล',
  5: 'หัวหน้าฝ่ายการเงิน',
};
