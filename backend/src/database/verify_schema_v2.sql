-- ============================================
-- PHTS System - Schema Verification Queries v2
-- Description: Verification queries for pts_requests schema after v2 migration
-- Purpose: Validate that migration completed successfully
-- Created: 2025-12-31
-- ============================================

-- ============================================
-- 1. Check all columns in pts_requests table
-- ============================================
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
ORDER BY ORDINAL_POSITION;

-- Expected: Should see 15 columns including the 7 new ones:
-- personnel_type, position_number, department_group, main_duty,
-- work_attributes, requested_amount, effective_date

-- ============================================
-- 2. Verify request_type ENUM values
-- ============================================
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'request_type';

-- Expected: enum('NEW_ENTRY','EDIT_INFO_SAME_RATE','EDIT_INFO_NEW_RATE')

-- ============================================
-- 3. Verify personnel_type ENUM values
-- ============================================
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'personnel_type';

-- Expected: enum('CIVIL_SERVANT','GOV_EMPLOYEE','PH_EMPLOYEE','TEMP_EMPLOYEE')

-- ============================================
-- 4. Check all indexes on pts_requests table
-- ============================================
SELECT
  INDEX_NAME,
  COLUMN_NAME,
  SEQ_IN_INDEX,
  INDEX_TYPE,
  INDEX_COMMENT
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;

-- Expected new indexes:
-- idx_pts_requests_personnel_type
-- idx_pts_requests_department_group
-- idx_pts_requests_effective_date
-- idx_pts_requests_amount
-- idx_pts_requests_type_status

-- ============================================
-- 5. Count total columns
-- ============================================
SELECT COUNT(*) as total_columns
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests';

-- Expected: 15 columns (8 original + 7 new)

-- ============================================
-- 6. Check for NULL values in new columns
-- ============================================
SELECT
  COUNT(*) as total_records,
  SUM(CASE WHEN personnel_type IS NULL THEN 1 ELSE 0 END) as null_personnel_type,
  SUM(CASE WHEN position_number IS NULL THEN 1 ELSE 0 END) as null_position_number,
  SUM(CASE WHEN department_group IS NULL THEN 1 ELSE 0 END) as null_department_group,
  SUM(CASE WHEN main_duty IS NULL THEN 1 ELSE 0 END) as null_main_duty,
  SUM(CASE WHEN work_attributes IS NULL THEN 1 ELSE 0 END) as null_work_attributes,
  SUM(CASE WHEN requested_amount IS NULL THEN 1 ELSE 0 END) as null_requested_amount,
  SUM(CASE WHEN effective_date IS NULL THEN 1 ELSE 0 END) as null_effective_date
FROM pts_requests;

-- Expected: For existing records, all new columns should be NULL
-- For new records after migration, they should be populated

-- ============================================
-- 7. Sample records with new fields
-- ============================================
SELECT
  request_id,
  user_id,
  request_type,
  personnel_type,
  position_number,
  department_group,
  main_duty,
  requested_amount,
  effective_date,
  status,
  created_at
FROM pts_requests
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 8. Check foreign key constraints
-- ============================================
SELECT
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Expected: fk_pts_requests_user_id -> users.user_id

-- ============================================
-- 9. Verify submission_data still exists (backward compatibility)
-- ============================================
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'submission_data';

-- Expected: Should exist with type 'json' and IS_NULLABLE = 'YES'

-- ============================================
-- 10. Table statistics
-- ============================================
SELECT
  TABLE_NAME,
  TABLE_ROWS as row_count,
  ROUND(DATA_LENGTH / 1024 / 1024, 2) as data_size_mb,
  ROUND(INDEX_LENGTH / 1024 / 1024, 2) as index_size_mb,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as total_size_mb
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'phts_system'
  AND TABLE_NAME = 'pts_requests';

-- ============================================
-- 11. Test work_attributes JSON structure
-- ============================================
-- This query will only work if there are records with work_attributes populated
SELECT
  request_id,
  work_attributes,
  JSON_EXTRACT(work_attributes, '$.operation') as has_operation,
  JSON_EXTRACT(work_attributes, '$.planning') as has_planning,
  JSON_EXTRACT(work_attributes, '$.coordination') as has_coordination,
  JSON_EXTRACT(work_attributes, '$.service') as has_service
FROM pts_requests
WHERE work_attributes IS NOT NULL
LIMIT 5;

-- ============================================
-- 12. Distribution by personnel_type
-- ============================================
SELECT
  personnel_type,
  COUNT(*) as request_count,
  AVG(requested_amount) as avg_amount,
  MIN(effective_date) as earliest_date,
  MAX(effective_date) as latest_date
FROM pts_requests
WHERE personnel_type IS NOT NULL
GROUP BY personnel_type
ORDER BY request_count DESC;

-- ============================================
-- 13. Distribution by request_type (new values)
-- ============================================
SELECT
  request_type,
  COUNT(*) as request_count,
  AVG(requested_amount) as avg_amount
FROM pts_requests
GROUP BY request_type
ORDER BY request_count DESC;

-- Expected to see: NEW_ENTRY, EDIT_INFO_SAME_RATE, EDIT_INFO_NEW_RATE

-- ============================================
-- 14. Requests by department_group
-- ============================================
SELECT
  department_group,
  COUNT(*) as request_count,
  AVG(requested_amount) as avg_amount
FROM pts_requests
WHERE department_group IS NOT NULL
GROUP BY department_group
ORDER BY request_count DESC
LIMIT 10;

-- ============================================
-- 15. Upcoming effective dates
-- ============================================
SELECT
  request_id,
  user_id,
  personnel_type,
  department_group,
  requested_amount,
  effective_date,
  status
FROM pts_requests
WHERE effective_date >= CURDATE()
  AND status = 'APPROVED'
ORDER BY effective_date ASC
LIMIT 10;

-- ============================================
-- Verification Complete
-- ============================================

/*
 * Summary of Checks:
 * ==================
 * 1. Column structure (15 total columns)
 * 2. ENUM values updated correctly
 * 3. All indexes created
 * 4. Foreign key constraints intact
 * 5. submission_data preserved for backward compatibility
 * 6. New columns are NULL-able
 * 7. Table statistics normal
 *
 * Success Criteria:
 * =================
 * ✓ All 7 new columns present
 * ✓ request_type ENUM has 3 new values
 * ✓ personnel_type ENUM has 4 values
 * ✓ 5 new indexes created
 * ✓ submission_data column still exists
 * ✓ No errors when querying new columns
 *
 * If all queries run successfully, migration is complete!
 */
