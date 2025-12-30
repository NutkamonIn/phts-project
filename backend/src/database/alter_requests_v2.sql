-- ============================================
-- PHTS System - Request Schema Migration v2
-- Description: Update pts_requests table with explicit form fields
-- Purpose: Replace generic JSON field with structured columns matching official P.T.S. form
-- Created: 2025-12-31
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- STEP 1: Add new explicit columns to pts_requests
-- ============================================

-- Add personnel_type column (ประเภทบุคลากร)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `personnel_type` ENUM(
  'CIVIL_SERVANT',
  'GOV_EMPLOYEE',
  'PH_EMPLOYEE',
  'TEMP_EMPLOYEE'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
COMMENT 'ประเภทบุคลากร: ข้าราชการ, พนักงานราชการ, พกส., ลูกจ้างชั่วคราว'
AFTER `request_type`;

-- Add position_number column (เลขที่ตำแหน่ง)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `position_number` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
COMMENT 'เลขที่ตำแหน่ง - Position identification number'
AFTER `personnel_type`;

-- Add department_group column (กลุ่มงาน/แผนก)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `department_group` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
COMMENT 'กลุ่มงาน/แผนก - Department or work group name'
AFTER `position_number`;

-- Add main_duty column (หน้าที่หลัก)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `main_duty` VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
COMMENT 'หน้าที่หลัก - Primary job responsibility'
AFTER `department_group`;

-- Add work_attributes column (ลักษณะงาน)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `work_attributes` JSON NULL
COMMENT 'ลักษณะงาน - Work attributes as JSON: {operation, planning, coordination, service}'
AFTER `main_duty`;

-- Add requested_amount column (ยอดเงินที่ขอ)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `requested_amount` DECIMAL(10,2) NULL
COMMENT 'ยอดเงินที่ขอ - Requested PTS allowance amount in THB'
AFTER `work_attributes`;

-- Add effective_date column (วันที่มีผล)
ALTER TABLE `pts_requests`
ADD COLUMN IF NOT EXISTS `effective_date` DATE NULL
COMMENT 'วันที่มีผล - Effective date for the request'
AFTER `requested_amount`;

-- ============================================
-- STEP 2: Modify request_type ENUM
-- ============================================

-- Modify request_type ENUM to split EDIT_INFO into two types
ALTER TABLE `pts_requests`
MODIFY COLUMN `request_type` ENUM(
  'NEW_ENTRY',
  'EDIT_INFO_SAME_RATE',
  'EDIT_INFO_NEW_RATE'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
COMMENT 'Type of PTS request: NEW_ENTRY, EDIT_INFO_SAME_RATE (แก้ไขข้อมูลอัตราเดิม), EDIT_INFO_NEW_RATE (แก้ไขข้อมูลอัตราใหม่)';

-- ============================================
-- STEP 3: Add indexes for new searchable columns
-- ============================================

-- Index for filtering by personnel_type
CREATE INDEX IF NOT EXISTS `idx_pts_requests_personnel_type`
ON `pts_requests` (`personnel_type` ASC)
USING BTREE
COMMENT 'Index for filtering requests by personnel type';

-- Index for searching by department_group
CREATE INDEX IF NOT EXISTS `idx_pts_requests_department_group`
ON `pts_requests` (`department_group`(50) ASC)
USING BTREE
COMMENT 'Index for searching requests by department/group';

-- Index for filtering by effective_date
CREATE INDEX IF NOT EXISTS `idx_pts_requests_effective_date`
ON `pts_requests` (`effective_date` DESC)
USING BTREE
COMMENT 'Index for filtering and sorting by effective date';

-- Index for amount-based queries
CREATE INDEX IF NOT EXISTS `idx_pts_requests_amount`
ON `pts_requests` (`requested_amount` DESC)
USING BTREE
COMMENT 'Index for amount-based filtering and reporting';

-- Composite index for common queries (request_type + status)
CREATE INDEX IF NOT EXISTS `idx_pts_requests_type_status`
ON `pts_requests` (`request_type` ASC, `status` ASC)
USING BTREE
COMMENT 'Composite index for filtering by request type and status';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- Migration completed successfully
-- ============================================

/*
 * Personnel Type Mapping:
 * =======================
 * CIVIL_SERVANT   -> ข้าราชการ (Civil Servant)
 * GOV_EMPLOYEE    -> พนักงานราชการ (Government Employee)
 * PH_EMPLOYEE     -> พนักงานกระทรวงสาธารณสุข (Public Health Ministry Employee)
 * TEMP_EMPLOYEE   -> ลูกจ้างชั่วคราว (Temporary Employee)
 *
 * Work Attributes JSON Structure:
 * ================================
 * {
 *   "operation": true,      // ปฏิบัติการ
 *   "planning": false,      // วางแผน
 *   "coordination": true,   // ประสานงาน
 *   "service": true         // บริการ
 * }
 *
 * Request Type Changes:
 * =====================
 * OLD: 'EDIT_INFO', 'RATE_CHANGE'
 * NEW: 'EDIT_INFO_SAME_RATE', 'EDIT_INFO_NEW_RATE'
 *
 * Rationale: Aligns with official P.T.S. form structure where
 * information edits are categorized by whether they affect the rate
 *
 * Data Preservation:
 * ==================
 * - submission_data JSON field is PRESERVED (not dropped)
 * - Existing data remains intact for backward compatibility
 * - New explicit columns provide better query performance and validation
 *
 * Notes:
 * ======
 * - All new columns are NULL to allow existing records to remain valid
 * - New requests should populate these fields at submission time
 * - Application layer should migrate submission_data to explicit fields gradually
 * - IF NOT EXISTS clauses ensure idempotent execution (safe to run multiple times)
 */
