/**
 * PHTS System - PTS Request Types V2
 *
 * TypeScript type definitions for the updated pts_requests table schema
 * Matches the official Thai P.T.S. paper form structure
 *
 * Date: 2025-12-31
 */

// ============================================
// ENUMS
// ============================================

/**
 * Personnel Type Enum (ประเภทบุคลากร)
 * Matches the official form classification
 */
export enum PersonnelType {
  CIVIL_SERVANT = 'CIVIL_SERVANT',     // ข้าราชการ
  GOV_EMPLOYEE = 'GOV_EMPLOYEE',       // พนักงานราชการ
  PH_EMPLOYEE = 'PH_EMPLOYEE',         // พนักงานกระทรวงสาธารณสุข (พกส.)
  TEMP_EMPLOYEE = 'TEMP_EMPLOYEE'      // ลูกจ้างชั่วคราว
}

/**
 * Request Type Enum (ประเภทคำขอ)
 * Updated to match 3 checkboxes on official form
 */
export enum RequestType {
  NEW_ENTRY = 'NEW_ENTRY',                     // ขอรับค่าตอบแทนใหม่
  EDIT_INFO_SAME_RATE = 'EDIT_INFO_SAME_RATE', // แก้ไขข้อมูล (อัตราเดิม)
  EDIT_INFO_NEW_RATE = 'EDIT_INFO_NEW_RATE'    // แก้ไขข้อมูล (อัตราใหม่)
}

/**
 * Request Status Enum
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED'
}

// ============================================
// INTERFACES
// ============================================

/**
 * Work Attributes Interface (ลักษณะงาน)
 * 4 checkboxes on the official P.T.S. form
 */
export interface WorkAttributes {
  operation: boolean;     // ปฏิบัติการ - Operational work
  planning: boolean;      // วางแผน - Planning/management work
  coordination: boolean;  // ประสานงาน - Coordination work
  service: boolean;       // บริการ - Service/patient care work
}

/**
 * PTS Request Interface (Complete)
 * Represents a full record from pts_requests table
 */
export interface PTSRequest {
  // Primary Key
  request_id: number;
  user_id: number;

  // Personnel Information (From Official Form)
  personnel_type: PersonnelType;
  position_number: string | null;
  department_group: string | null;
  main_duty: string | null;

  // Work Attributes (4 Checkboxes)
  work_attributes: WorkAttributes | null;

  // Request Details
  request_type: RequestType;
  requested_amount: number | null;  // DECIMAL(10,2)
  effective_date: string | null;    // DATE as YYYY-MM-DD

  // Workflow Status
  current_step: number;
  status: RequestStatus;

  // Legacy/Archive (Backward Compatibility)
  submission_data: any | null;

  // Timestamps
  created_at: string;  // ISO 8601 datetime
  updated_at: string;  // ISO 8601 datetime
}

/**
 * PTS Request Create DTO
 * Data Transfer Object for creating a new request
 */
export interface CreatePTSRequestDTO {
  user_id: number;

  // Personnel Information
  personnel_type: PersonnelType;
  position_number?: string;
  department_group?: string;
  main_duty?: string;

  // Work Attributes
  work_attributes?: WorkAttributes;

  // Request Details
  request_type: RequestType;
  requested_amount?: number;
  effective_date?: string;  // YYYY-MM-DD

  // Optional legacy data
  submission_data?: any;
}

/**
 * PTS Request Update DTO
 * Data Transfer Object for updating an existing request
 */
export interface UpdatePTSRequestDTO {
  // Personnel Information (all optional)
  personnel_type?: PersonnelType;
  position_number?: string | null;
  department_group?: string | null;
  main_duty?: string | null;

  // Work Attributes
  work_attributes?: WorkAttributes | null;

  // Request Details
  request_type?: RequestType;
  requested_amount?: number | null;
  effective_date?: string | null;

  // Workflow Status
  current_step?: number;
  status?: RequestStatus;

  // Legacy data
  submission_data?: any | null;
}

/**
 * PTS Request Query Filter
 * For filtering/searching requests
 */
export interface PTSRequestQueryFilter {
  user_id?: number;
  personnel_type?: PersonnelType;
  request_type?: RequestType;
  status?: RequestStatus;
  current_step?: number;
  effective_date_from?: string;
  effective_date_to?: string;
  created_at_from?: string;
  created_at_to?: string;
  department_group?: string;
}

/**
 * PTS Request Summary
 * Lightweight version for list views
 */
export interface PTSRequestSummary {
  request_id: number;
  user_id: number;
  personnel_type: PersonnelType;
  request_type: RequestType;
  requested_amount: number | null;
  effective_date: string | null;
  status: RequestStatus;
  current_step: number;
  created_at: string;
}

// ============================================
// LABEL MAPPINGS (For UI Display)
// ============================================

/**
 * Personnel Type Labels (Thai)
 */
export const PersonnelTypeLabels: Record<PersonnelType, string> = {
  [PersonnelType.CIVIL_SERVANT]: 'ข้าราชการ',
  [PersonnelType.GOV_EMPLOYEE]: 'พนักงานราชการ',
  [PersonnelType.PH_EMPLOYEE]: 'พนักงานกระทรวงสาธารณสุข (พกส.)',
  [PersonnelType.TEMP_EMPLOYEE]: 'ลูกจ้างชั่วคราว'
};

/**
 * Request Type Labels (Thai)
 */
export const RequestTypeLabels: Record<RequestType, string> = {
  [RequestType.NEW_ENTRY]: 'ขอรับค่าตอบแทนใหม่',
  [RequestType.EDIT_INFO_SAME_RATE]: 'แก้ไขข้อมูล (อัตราเดิม)',
  [RequestType.EDIT_INFO_NEW_RATE]: 'แก้ไขข้อมูล (อัตราใหม่)'
};

/**
 * Request Status Labels (Thai)
 */
export const RequestStatusLabels: Record<RequestStatus, string> = {
  [RequestStatus.DRAFT]: 'ร่าง',
  [RequestStatus.PENDING]: 'รออนุมัติ',
  [RequestStatus.APPROVED]: 'อนุมัติ',
  [RequestStatus.REJECTED]: 'ไม่อนุมัติ',
  [RequestStatus.CANCELLED]: 'ยกเลิก',
  [RequestStatus.RETURNED]: 'ส่งกลับแก้ไข'
};

/**
 * Work Attribute Labels (Thai)
 */
export const WorkAttributeLabels = {
  operation: 'ปฏิบัติการ',
  planning: 'วางแผน',
  coordination: 'ประสานงาน',
  service: 'บริการ'
};

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate Work Attributes structure
 */
export function isValidWorkAttributes(data: any): data is WorkAttributes {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.operation === 'boolean' &&
    typeof data.planning === 'boolean' &&
    typeof data.coordination === 'boolean' &&
    typeof data.service === 'boolean'
  );
}

/**
 * Validate requested amount (must be positive)
 */
export function isValidRequestedAmount(amount: number): boolean {
  return amount > 0 && amount <= 999999.99;
}

/**
 * Validate effective date (cannot be in the past)
 */
export function isValidEffectiveDate(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

/**
 * Check if request type requires documents
 */
export function requiresDocuments(requestType: RequestType): boolean {
  return requestType === RequestType.NEW_ENTRY;
}

// ============================================
// DEFAULT VALUES
// ============================================

/**
 * Default work attributes (all unchecked)
 */
export const DEFAULT_WORK_ATTRIBUTES: WorkAttributes = {
  operation: false,
  planning: false,
  coordination: false,
  service: false
};

/**
 * Default personnel type
 */
export const DEFAULT_PERSONNEL_TYPE = PersonnelType.CIVIL_SERVANT;

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if value is a valid PersonnelType
 */
export function isPersonnelType(value: any): value is PersonnelType {
  return Object.values(PersonnelType).includes(value);
}

/**
 * Check if value is a valid RequestType
 */
export function isRequestType(value: any): value is RequestType {
  return Object.values(RequestType).includes(value);
}

/**
 * Check if value is a valid RequestStatus
 */
export function isRequestStatus(value: any): value is RequestStatus {
  return Object.values(RequestStatus).includes(value);
}

// ============================================
// WORKFLOW HELPERS
// ============================================

/**
 * Get approver role name for workflow step
 */
export function getApproverRole(step: number): string {
  const roles: Record<number, string> = {
    1: 'Head of Department',
    2: 'PTS Officer',
    3: 'Head of HR',
    4: 'Director',
    5: 'Finance Head',
    6: 'Completed'
  };
  return roles[step] || 'Unknown';
}

/**
 * Get Thai approver role name for workflow step
 */
export function getApproverRoleThai(step: number): string {
  const roles: Record<number, string> = {
    1: 'หัวหน้ากลุ่มงาน',
    2: 'เจ้าหน้าที่ P.T.S.',
    3: 'หัวหน้าฝ่ายทรัพยากรบุคคล',
    4: 'ผู้อำนวยการ',
    5: 'หัวหน้าฝ่ายการเงิน',
    6: 'เสร็จสิ้น'
  };
  return roles[step] || 'ไม่ระบุ';
}

/**
 * Check if request can be edited
 */
export function canEditRequest(status: RequestStatus): boolean {
  return status === RequestStatus.DRAFT || status === RequestStatus.RETURNED;
}

/**
 * Check if request can be cancelled
 */
export function canCancelRequest(status: RequestStatus): boolean {
  return status === RequestStatus.DRAFT || status === RequestStatus.PENDING;
}
