-- ============================================
-- PTS Requests V2 - Sample Queries
-- Demonstrates usage of new official form fields
-- Date: 2025-12-31
-- ============================================

-- ============================================
-- 1. INSERT EXAMPLES
-- ============================================

-- Example 1: New civil servant doctor requesting PTS allowance
INSERT INTO pts_requests (
  user_id,
  personnel_type,
  position_number,
  department_group,
  main_duty,
  work_attributes,
  request_type,
  requested_amount,
  effective_date,
  current_step,
  status
) VALUES (
  1,
  'CIVIL_SERVANT',
  'PH-MED-001',
  'กลุ่มงานแพทย์',
  'ตรวจรักษาผู้ป่วยใน ICU',
  '{"operation": true, "planning": false, "coordination": true, "service": true}',
  'NEW_ENTRY',
  15000.00,
  '2025-02-01',
  1,
  'DRAFT'
);

-- Example 2: Government employee nurse requesting rate change
INSERT INTO pts_requests (
  user_id,
  personnel_type,
  position_number,
  department_group,
  main_duty,
  work_attributes,
  request_type,
  requested_amount,
  effective_date,
  current_step,
  status
) VALUES (
  2,
  'GOV_EMPLOYEE',
  'PH-NUR-025',
  'กลุ่มงานการพยาบาล',
  'ดูแลผู้ป่วยหอผู้ป่วยวิกฤต',
  '{"operation": true, "planning": false, "coordination": false, "service": true}',
  'EDIT_INFO_NEW_RATE',
  2000.00,
  '2025-03-01',
  1,
  'PENDING'
);

-- Example 3: Ministry of Public Health pharmacist editing info (same rate)
INSERT INTO pts_requests (
  user_id,
  personnel_type,
  position_number,
  department_group,
  main_duty,
  work_attributes,
  request_type,
  requested_amount,
  effective_date,
  current_step,
  status
) VALUES (
  3,
  'PH_EMPLOYEE',
  'PH-PHM-010',
  'กลุ่มงานเภสัชกรรม',
  'จ่ายยา/ตรวจสอบใบสั่งยา',
  '{"operation": true, "planning": false, "coordination": true, "service": true}',
  'EDIT_INFO_SAME_RATE',
  3000.00,
  '2025-02-15',
  1,
  'DRAFT'
);

-- ============================================
-- 2. SELECT QUERIES - Filtering by New Fields
-- ============================================

-- Query 1: Find all civil servants with pending requests
SELECT
  request_id,
  user_id,
  personnel_type,
  position_number,
  department_group,
  request_type,
  requested_amount,
  status,
  created_at
FROM pts_requests
WHERE personnel_type = 'CIVIL_SERVANT'
  AND status = 'PENDING'
ORDER BY created_at DESC;

-- Query 2: Get all requests effective in February 2025
SELECT
  request_id,
  user_id,
  personnel_type,
  department_group,
  main_duty,
  requested_amount,
  effective_date,
  status
FROM pts_requests
WHERE effective_date BETWEEN '2025-02-01' AND '2025-02-29'
ORDER BY effective_date ASC;

-- Query 3: Find requests with "service" work attribute
SELECT
  request_id,
  user_id,
  department_group,
  main_duty,
  work_attributes,
  requested_amount
FROM pts_requests
WHERE JSON_EXTRACT(work_attributes, '$.service') = true
  AND status IN ('PENDING', 'APPROVED');

-- Query 4: Get total requested amount by personnel type
SELECT
  personnel_type,
  COUNT(*) as total_requests,
  SUM(requested_amount) as total_amount,
  AVG(requested_amount) as avg_amount,
  MIN(requested_amount) as min_amount,
  MAX(requested_amount) as max_amount
FROM pts_requests
WHERE status = 'APPROVED'
  AND requested_amount IS NOT NULL
GROUP BY personnel_type
ORDER BY total_amount DESC;

-- Query 5: Find all requests with planning and coordination attributes
SELECT
  request_id,
  user_id,
  department_group,
  main_duty,
  work_attributes,
  requested_amount
FROM pts_requests
WHERE JSON_EXTRACT(work_attributes, '$.planning') = true
  AND JSON_EXTRACT(work_attributes, '$.coordination') = true;

-- ============================================
-- 3. UPDATE QUERIES
-- ============================================

-- Update 1: Change personnel type
UPDATE pts_requests
SET personnel_type = 'GOV_EMPLOYEE'
WHERE request_id = 1;

-- Update 2: Update work attributes
UPDATE pts_requests
SET work_attributes = JSON_OBJECT(
  'operation', true,
  'planning', true,
  'coordination', false,
  'service', false
)
WHERE request_id = 2;

-- Update 3: Change effective date and requested amount
UPDATE pts_requests
SET
  effective_date = '2025-03-01',
  requested_amount = 12000.00,
  updated_at = CURRENT_TIMESTAMP
WHERE request_id = 3;

-- ============================================
-- 4. COMPLEX JOINS
-- ============================================

-- Query 6: Join with users to get full employee info
SELECT
  pr.request_id,
  pr.personnel_type,
  pr.position_number,
  pr.department_group,
  pr.main_duty,
  pr.requested_amount,
  pr.effective_date,
  pr.status,
  u.username,
  u.role
FROM pts_requests pr
JOIN users u ON pr.user_id = u.user_id
WHERE pr.status = 'PENDING'
ORDER BY pr.created_at DESC;

-- Query 7: Get requests with employee details from HRMS view
SELECT
  pr.request_id,
  pr.personnel_type,
  pr.position_number,
  pr.department_group,
  pr.requested_amount,
  pr.effective_date,
  e.first_name,
  e.last_name,
  e.position_name,
  e.current_pts_rate
FROM pts_requests pr
JOIN users u ON pr.user_id = u.user_id
JOIN employees e ON u.citizen_id = e.citizen_id
WHERE pr.status IN ('PENDING', 'APPROVED')
  AND pr.personnel_type = 'CIVIL_SERVANT'
ORDER BY pr.effective_date ASC;

-- ============================================
-- 5. REPORTING QUERIES
-- ============================================

-- Report 1: Monthly summary by request type
SELECT
  DATE_FORMAT(created_at, '%Y-%m') as month,
  request_type,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
  SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
  SUM(requested_amount) as total_amount_requested
FROM pts_requests
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
GROUP BY month, request_type
ORDER BY month DESC, request_type;

-- Report 2: Department-wise requests with average amounts
SELECT
  department_group,
  personnel_type,
  COUNT(*) as total_requests,
  AVG(requested_amount) as avg_amount,
  SUM(CASE WHEN status = 'APPROVED' THEN requested_amount ELSE 0 END) as approved_amount
FROM pts_requests
WHERE department_group IS NOT NULL
  AND requested_amount IS NOT NULL
GROUP BY department_group, personnel_type
ORDER BY total_requests DESC;

-- Report 3: Requests pending approval by step
SELECT
  current_step,
  CASE current_step
    WHEN 1 THEN 'Head of Department'
    WHEN 2 THEN 'PTS Officer'
    WHEN 3 THEN 'Head of HR'
    WHEN 4 THEN 'Director'
    WHEN 5 THEN 'Finance Head'
    ELSE 'Completed'
  END as approver_role,
  personnel_type,
  COUNT(*) as pending_count,
  AVG(DATEDIFF(CURDATE(), created_at)) as avg_days_pending
FROM pts_requests
WHERE status = 'PENDING'
GROUP BY current_step, personnel_type
ORDER BY current_step, personnel_type;

-- ============================================
-- 6. DATA VALIDATION QUERIES
-- ============================================

-- Validation 1: Check for invalid work_attributes JSON structure
SELECT
  request_id,
  work_attributes,
  'Invalid JSON structure' as issue
FROM pts_requests
WHERE work_attributes IS NOT NULL
  AND (
    JSON_EXTRACT(work_attributes, '$.operation') IS NULL OR
    JSON_EXTRACT(work_attributes, '$.planning') IS NULL OR
    JSON_EXTRACT(work_attributes, '$.coordination') IS NULL OR
    JSON_EXTRACT(work_attributes, '$.service') IS NULL
  );

-- Validation 2: Check for requests with effective_date in the past
SELECT
  request_id,
  user_id,
  effective_date,
  status,
  DATEDIFF(CURDATE(), effective_date) as days_overdue
FROM pts_requests
WHERE effective_date < CURDATE()
  AND status IN ('DRAFT', 'PENDING')
ORDER BY effective_date ASC;

-- Validation 3: Check for negative or zero requested amounts
SELECT
  request_id,
  requested_amount,
  'Invalid amount' as issue
FROM pts_requests
WHERE requested_amount IS NOT NULL
  AND requested_amount <= 0;

-- ============================================
-- 7. MIGRATION VERIFICATION QUERIES
-- ============================================

-- Check 1: Verify all new columns exist
DESCRIBE pts_requests;

-- Check 2: Verify new indexes
SHOW INDEXES FROM pts_requests
WHERE Key_name IN ('idx_pts_requests_personnel_type', 'idx_pts_requests_effective_date');

-- Check 3: Verify ENUM values for request_type
SHOW COLUMNS FROM pts_requests LIKE 'request_type';

-- Check 4: Verify ENUM values for personnel_type
SHOW COLUMNS FROM pts_requests LIKE 'personnel_type';

-- Check 5: Count records by personnel_type (should show default CIVIL_SERVANT for old records)
SELECT
  personnel_type,
  COUNT(*) as count
FROM pts_requests
GROUP BY personnel_type;

-- ============================================
-- 8. BULK UPDATE EXAMPLES
-- ============================================

-- Update existing records with department info from employees view
UPDATE pts_requests pr
JOIN users u ON pr.user_id = u.user_id
JOIN employees e ON u.citizen_id = e.citizen_id
SET
  pr.department_group = e.department,
  pr.main_duty = e.position_name
WHERE pr.department_group IS NULL;

-- Set default work_attributes for records missing it
UPDATE pts_requests
SET work_attributes = JSON_OBJECT(
  'operation', true,
  'planning', false,
  'coordination', false,
  'service', true
)
WHERE work_attributes IS NULL
  AND status IN ('PENDING', 'APPROVED');

-- ============================================
-- 9. PERFORMANCE TESTING QUERIES
-- ============================================

-- Test index usage on personnel_type
EXPLAIN SELECT * FROM pts_requests
WHERE personnel_type = 'CIVIL_SERVANT'
  AND status = 'PENDING';

-- Test index usage on effective_date
EXPLAIN SELECT * FROM pts_requests
WHERE effective_date BETWEEN '2025-01-01' AND '2025-12-31'
ORDER BY effective_date ASC;

-- Test composite index usage
EXPLAIN SELECT * FROM pts_requests
WHERE status = 'PENDING'
  AND current_step = 1
  AND personnel_type = 'GOV_EMPLOYEE';

-- ============================================
-- End of Sample Queries
-- ============================================
