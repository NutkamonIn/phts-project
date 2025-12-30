/*
 * PHTS System - Request & Workflow System Tables Initialization
 *
 * This file creates the database tables for Part 2: Request & Workflow System
 * Implements a 5-step approval workflow for PTS requests with audit logging and file attachments.
 *
 * Workflow Steps:
 * - Step 1: Head of Department (Individual approval)
 * - Step 2: PTS Officer (Document verification)
 * - Step 3: Head of HR (Rules verification)
 * - Step 4: Director (Batch approval support)
 * - Step 5: Finance Head (Final check)
 * - Step 6: Completed (Status = APPROVED)
 *
 * Tables Created:
 * 1. pts_requests - Main request header table
 * 2. pts_request_actions - Approval action audit log
 * 3. pts_attachments - File attachments for requests
 *
 * Date: 2025-12-30
 */

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- Table: pts_requests
-- Description: Main table storing PTS request headers (Digital version of official P.T.S. paper form)
-- Purpose: Tracks request lifecycle, current workflow step, and official form data
-- Updated: 2025-12-31 - Added fields to match official Thai P.T.S. government form
-- ============================================
CREATE TABLE IF NOT EXISTS `pts_requests` (
  `request_id` INT NOT NULL AUTO_INCREMENT COMMENT 'Primary key for requests table',
  `user_id` INT NOT NULL COMMENT 'Foreign key to users.user_id - the requester',

  -- Personnel Information (From Official Form)
  `personnel_type` ENUM(
    'CIVIL_SERVANT',
    'GOV_EMPLOYEE',
    'PH_EMPLOYEE',
    'TEMP_EMPLOYEE'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CIVIL_SERVANT'
    COMMENT 'ประเภทบุคลากร: ข้าราชการ/พนักงานราชการ/พกส./ลูกจ้าง',
  `position_number` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    COMMENT 'เลขที่ตำแหน่ง - Government position ID',
  `department_group` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    COMMENT 'กลุ่มงาน/แผนก - Department/work group',
  `main_duty` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
    COMMENT 'หน้าที่หลัก - Primary job responsibility',

  -- Work Attributes (4 Checkboxes on Official Form)
  `work_attributes` JSON NULL
    COMMENT 'ลักษณะงาน: {operation, planning, coordination, service}',

  -- Request Details
  `request_type` ENUM(
    'NEW_ENTRY',
    'EDIT_INFO_SAME_RATE',
    'EDIT_INFO_NEW_RATE'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
    COMMENT 'ประเภทคำขอ: ขอใหม่/แก้ไขอัตราเดิม/แก้ไขอัตราใหม่',
  `requested_amount` DECIMAL(10,2) NULL
    COMMENT 'ยอดเงินที่ขอ - Amount requested in the form',
  `effective_date` DATE NULL
    COMMENT 'วันที่มีผล - Date when changes take effect',

  -- Workflow Status
  `current_step` INT NOT NULL DEFAULT 1
    COMMENT 'ขั้นตอนปัจจุบัน - Current workflow step (1-6)',
  `status` ENUM(
    'DRAFT',
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'RETURNED'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT'
    COMMENT 'สถานะคำขอ - Current status of the request',

  -- Legacy/Archive Field (Keep for backward compatibility)
  `submission_data` JSON NULL
    COMMENT 'ข้อมูลเพิ่มเติม - Additional data (JSON) for backward compatibility',

  -- Timestamps
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Timestamp when request was created',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    COMMENT 'Timestamp when request was last updated',

  -- Primary Key
  PRIMARY KEY (`request_id`) USING BTREE,

  -- Foreign Keys
  CONSTRAINT `fk_pts_requests_user_id` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,

  -- Indexes
  INDEX `idx_pts_requests_user_id` (`user_id` ASC) USING BTREE
    COMMENT 'Index for querying requests by user',
  INDEX `idx_pts_requests_status` (`status` ASC) USING BTREE
    COMMENT 'Index for filtering by status',
  INDEX `idx_pts_requests_current_step` (`current_step` ASC) USING BTREE
    COMMENT 'Index for filtering by workflow step',
  INDEX `idx_pts_requests_status_step` (`status` ASC, `current_step` ASC) USING BTREE
    COMMENT 'Composite index for filtering by status and current step',
  INDEX `idx_pts_requests_personnel_type` (`personnel_type` ASC) USING BTREE
    COMMENT 'Index for filtering by personnel type',
  INDEX `idx_pts_requests_effective_date` (`effective_date` ASC) USING BTREE
    COMMENT 'Index for filtering by effective date',
  INDEX `idx_pts_requests_created_at` (`created_at` DESC) USING BTREE
    COMMENT 'Index for sorting by creation date'
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'P.T.S. Request Forms - Digital version of official paper form'
  ROW_FORMAT = Dynamic;

-- ============================================
-- Table: pts_request_actions
-- Description: Audit log for all actions taken on requests
-- Purpose: Maintains complete approval history for compliance and traceability
-- ============================================
CREATE TABLE IF NOT EXISTS `pts_request_actions` (
  `action_id` INT NOT NULL AUTO_INCREMENT COMMENT 'Primary key for actions table',
  `request_id` INT NOT NULL COMMENT 'Foreign key to pts_requests.request_id',
  `actor_id` INT NOT NULL COMMENT 'Foreign key to users.user_id - who performed this action',
  `step_no` INT NOT NULL COMMENT 'Workflow step number when this action occurred (1-5)',
  `action` ENUM(
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'RETURN'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Type of action performed',
  `comment` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'Optional comment/note from the actor (supports Thai text)',
  `signature_snapshot` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'File path to digital signature image if captured',
  `action_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when action was performed',
  PRIMARY KEY (`action_id`) USING BTREE,
  INDEX `idx_pts_request_actions_request_id` (`request_id` ASC) USING BTREE COMMENT 'Index for querying actions by request',
  INDEX `idx_pts_request_actions_actor_id` (`actor_id` ASC) USING BTREE COMMENT 'Index for querying actions by actor',
  INDEX `idx_pts_request_actions_action_date` (`action_date` DESC) USING BTREE COMMENT 'Index for sorting by action date',
  CONSTRAINT `fk_pts_request_actions_request_id` FOREIGN KEY (`request_id`) REFERENCES `pts_requests` (`request_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_pts_request_actions_actor_id` FOREIGN KEY (`actor_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Approval action audit log - immutable history of all request actions'
  ROW_FORMAT = Dynamic;

-- ============================================
-- Table: pts_attachments
-- Description: File attachments linked to requests
-- Purpose: Stores metadata for uploaded documents (licenses, diplomas, orders)
-- ============================================
CREATE TABLE IF NOT EXISTS `pts_attachments` (
  `attachment_id` INT NOT NULL AUTO_INCREMENT COMMENT 'Primary key for attachments table',
  `request_id` INT NOT NULL COMMENT 'Foreign key to pts_requests.request_id',
  `file_type` ENUM(
    'LICENSE',
    'DIPLOMA',
    'ORDER_DOC',
    'OTHER'
  ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Category of the uploaded file',
  `file_path` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Relative path to the file in storage (e.g., uploads/documents/...)',
  `original_filename` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Original filename as uploaded by user (supports Thai characters)',
  `file_size` INT NOT NULL COMMENT 'File size in bytes (max 5MB = 5242880 bytes)',
  `mime_type` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'MIME type of the file (e.g., application/pdf, image/jpeg)',
  `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when file was uploaded',
  PRIMARY KEY (`attachment_id`) USING BTREE,
  INDEX `idx_pts_attachments_request_id` (`request_id` ASC) USING BTREE COMMENT 'Index for querying attachments by request',
  INDEX `idx_pts_attachments_file_type` (`file_type` ASC) USING BTREE COMMENT 'Index for filtering by file type',
  CONSTRAINT `fk_pts_attachments_request_id` FOREIGN KEY (`request_id`) REFERENCES `pts_requests` (`request_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB
  AUTO_INCREMENT = 1
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'File attachment metadata table - stores information about uploaded documents'
  ROW_FORMAT = Dynamic;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Tables created successfully
-- Next step: Run migrate_requests.ts to execute this schema
-- ============================================

/*
 * Foreign Key Relationships Summary:
 * ===================================
 *
 * pts_requests
 *   -> users.user_id (ON DELETE RESTRICT)
 *      Prevents deletion of users who have submitted requests
 *
 * pts_request_actions
 *   -> pts_requests.request_id (ON DELETE CASCADE)
 *      Automatically deletes action history when request is deleted
 *   -> users.user_id (ON DELETE RESTRICT)
 *      Preserves audit trail even if user account changes
 *
 * pts_attachments
 *   -> pts_requests.request_id (ON DELETE CASCADE)
 *      Automatically deletes attachments when request is deleted
 *
 * Workflow State Machine:
 * =======================
 *
 * Status: DRAFT
 *   - User is still editing the request
 *   - current_step = 1
 *   - User can edit/delete freely
 *
 * Status: PENDING
 *   - Request has been submitted and is awaiting approval
 *   - current_step indicates which approver should act (1-5)
 *   - Moves forward when approved, stays when rejected
 *
 * Status: RETURNED
 *   - Approver sent back for revisions
 *   - User can edit and re-submit
 *
 * Status: REJECTED
 *   - Request was denied by an approver
 *   - Terminal state (cannot be edited)
 *
 * Status: CANCELLED
 *   - User cancelled their own request
 *   - Terminal state
 *
 * Status: APPROVED
 *   - All 5 steps completed successfully
 *   - current_step = 6
 *   - Triggers master data update (Part 3)
 *   - Terminal state
 *
 * Request Types (Matches Official Form):
 * ========================================
 *
 * NEW_ENTRY (ขอรับค่าตอบแทนใหม่)
 *   - First time application for PTS allowance
 *   - Requires: LICENSE, DIPLOMA, ORDER_DOC
 *
 * EDIT_INFO_SAME_RATE (แก้ไขข้อมูล - อัตราเดิม)
 *   - Update personal/position information, keep same PTS rate
 *   - Requires: Supporting documents as needed
 *
 * EDIT_INFO_NEW_RATE (แก้ไขข้อมูล - อัตราใหม่)
 *   - Update information with new PTS rate change
 *   - Requires: Justification documents (ORDER_DOC, LICENSE updates, etc.)
 *
 * Personnel Types (ประเภทบุคลากร):
 * ==================================
 *
 * CIVIL_SERVANT (ข้าราชการ)
 *   - Government civil servants
 *
 * GOV_EMPLOYEE (พนักงานราชการ)
 *   - Government employees (non-civil servant)
 *
 * PH_EMPLOYEE (พนักงานกระทรวงสาธารณสุข - พกส.)
 *   - Ministry of Public Health employees
 *
 * TEMP_EMPLOYEE (ลูกจ้างชั่วคราว)
 *   - Temporary employees
 *
 * Work Attributes JSON Structure (ลักษณะงาน):
 * =============================================
 *
 * {
 *   "operation": true,      // ปฏิบัติการ - Operational work
 *   "planning": false,      // วางแผน - Planning work
 *   "coordination": true,   // ประสานงาน - Coordination work
 *   "service": true         // บริการ - Service/patient care work
 * }
 *
 * New Fields Added (2025-12-31):
 * ===============================
 *
 * - personnel_type: Employee classification required on official form
 * - position_number: Government position ID (เลขที่ตำแหน่ง) - Critical for HR tracking
 * - department_group: Department/work unit (กลุ่มงาน/แผนก)
 * - main_duty: Primary job responsibility (หน้าที่หลัก)
 * - work_attributes: JSON object for 4 work attribute checkboxes
 * - requested_amount: Amount requested on the form (ยอดเงินที่ขอ)
 * - effective_date: Date when changes become effective (วันที่มีผล)
 */
