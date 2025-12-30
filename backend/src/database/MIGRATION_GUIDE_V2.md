# PHTS Request Schema Migration Guide v2

## Overview

This migration updates the `pts_requests` table to align with the official Thai government P.T.S. (ค่าตอบแทนกำลังคนด้านสาธารณสุข) application form structure. The changes replace the generic `submission_data` JSON field with explicit, validated columns for better performance and data integrity.

## Migration Date
**Created:** 2025-12-31

## Changes Summary

### 1. New Columns Added

| Column | Type | Thai Label | Description |
|--------|------|------------|-------------|
| `personnel_type` | ENUM | ประเภทบุคลากร | Personnel classification type |
| `position_number` | VARCHAR(50) | เลขที่ตำแหน่ง | Official position number |
| `department_group` | VARCHAR(100) | กลุ่มงาน/แผนก | Department or work group |
| `main_duty` | VARCHAR(100) | หน้าที่หลัก | Primary job responsibility |
| `work_attributes` | JSON | ลักษณะงาน | Work characteristics (boolean flags) |
| `requested_amount` | DECIMAL(10,2) | ยอดเงินที่ขอ | Requested PTS allowance amount |
| `effective_date` | DATE | วันที่มีผล | Effective date for the request |

### 2. ENUM Value Changes

#### `personnel_type` ENUM (NEW)
- `CIVIL_SERVANT` - ข้าราชการ (Civil Servant)
- `GOV_EMPLOYEE` - พนักงานราชการ (Government Employee)
- `PH_EMPLOYEE` - พนักงานกระทรวงสาธารณสุข (Public Health Ministry Employee)
- `TEMP_EMPLOYEE` - ลูกจ้างชั่วคราว (Temporary Employee)

#### `request_type` ENUM (MODIFIED)

**Before:**
```sql
ENUM('NEW_ENTRY', 'EDIT_INFO', 'RATE_CHANGE')
```

**After:**
```sql
ENUM('NEW_ENTRY', 'EDIT_INFO_SAME_RATE', 'EDIT_INFO_NEW_RATE')
```

**Rationale:** The official form separates information edits based on whether they affect the PTS rate:
- `EDIT_INFO_SAME_RATE` (แก้ไขข้อมูลอัตราเดิม) - Edit information, same rate
- `EDIT_INFO_NEW_RATE` (แก้ไขข้อมูลอัตราใหม่) - Edit information, new rate

### 3. Work Attributes JSON Structure

```json
{
  "operation": true,      // ปฏิบัติการ (Operational work)
  "planning": false,      // วางแผน (Planning work)
  "coordination": true,   // ประสานงาน (Coordination work)
  "service": true         // บริการ (Service work)
}
```

All boolean fields are optional. `true` indicates the employee performs that type of work.

### 4. New Indexes

The following indexes were added to optimize query performance:

```sql
idx_pts_requests_personnel_type       -- Filter by personnel type
idx_pts_requests_department_group     -- Search by department
idx_pts_requests_effective_date       -- Filter/sort by effective date
idx_pts_requests_amount               -- Amount-based queries
idx_pts_requests_type_status          -- Composite: request_type + status
```

## Files Created

### SQL Files
- **`alter_requests_v2.sql`** - Raw SQL with all ALTER TABLE statements
  - Path: `backend/src/database/alter_requests_v2.sql`
  - Contains: Column additions, ENUM modifications, index creation
  - Features: Idempotent (safe to run multiple times)

### TypeScript Scripts
- **`update_requests_schema.ts`** - Migration execution script
  - Path: `backend/src/scripts/update_requests_schema.ts`
  - Validates prerequisites, executes migration, verifies results
  - Provides detailed logging and error handling

## How to Run Migration

### Prerequisites
1. Database `phts_system` exists
2. Table `pts_requests` already created (run `migrate_requests.ts` first if needed)
3. Database credentials configured in `.env`
4. Node.js 18+ and dependencies installed

### Execution Steps

#### Option 1: Using npm script (Recommended)
```bash
cd backend
npm run migrate:update-schema
```

#### Option 2: Using tsx directly
```bash
cd backend
npx tsx src/scripts/update_requests_schema.ts
```

#### Option 3: Execute SQL file manually
```bash
mysql -u root -p phts_system < src/database/alter_requests_v2.sql
```

### Expected Output

```
========================================
PHTS Request Schema Update (v2)
========================================

Reading migration SQL file...
Path: D:\phts-workspace\phts-project\backend\src\database\alter_requests_v2.sql

  ✓ SQL file loaded successfully

Connecting to database: phts_system@localhost...
  ✓ Database connection established

Verifying prerequisites...
  ✓ Table pts_requests exists

Current Schema Information:
----------------------------------------

Total columns: 8
Existing columns:
  - request_id
  - user_id
  - request_type
  - current_step
  - status
  - submission_data
  - created_at
  - updated_at

Executing schema migration...

  ✓ Migration SQL executed successfully

Verifying new columns...

  ✓ Column 'personnel_type' exists
  ✓ Column 'position_number' exists
  ✓ Column 'department_group' exists
  ✓ Column 'main_duty' exists
  ✓ Column 'work_attributes' exists
  ✓ Column 'requested_amount' exists
  ✓ Column 'effective_date' exists

  ✓ All 7 new columns verified

Verifying request_type ENUM update...

  Current ENUM definition: enum('NEW_ENTRY','EDIT_INFO_SAME_RATE','EDIT_INFO_NEW_RATE')

  ✓ request_type ENUM updated successfully
    - NEW_ENTRY
    - EDIT_INFO_SAME_RATE
    - EDIT_INFO_NEW_RATE

========================================
Migration Completed Successfully
========================================
```

## Data Preservation

**IMPORTANT:** The migration is **non-destructive**:
- ✓ `submission_data` JSON field is **PRESERVED**
- ✓ All existing data remains intact
- ✓ All new columns are NULL-able
- ✓ Existing rows remain valid after migration

## Backward Compatibility

### Before Migration
```typescript
// Old request submission format
const request = {
  user_id: 123,
  request_type: 'EDIT_INFO',
  submission_data: {
    personnel_type: 'CIVIL_SERVANT',
    position_number: 'P-12345',
    department_group: 'กลุ่มงานการพยาบาล',
    // ... all data in JSON
  }
}
```

### After Migration
```typescript
// New request submission format (recommended)
const request = {
  user_id: 123,
  request_type: 'EDIT_INFO_SAME_RATE',
  personnel_type: 'CIVIL_SERVANT',        // Explicit column
  position_number: 'P-12345',             // Explicit column
  department_group: 'กลุ่มงานการพยาบาล',  // Explicit column
  main_duty: 'พยาบาลวิชาชีพ',
  work_attributes: {
    operation: true,
    service: true
  },
  requested_amount: 2000.00,
  effective_date: '2025-01-01',
  submission_data: { /* backup copy */ }  // Optional, keep for audit
}
```

## TypeScript Interface Updates

Update your TypeScript interfaces to reflect the new schema:

```typescript
// Before
type RequestType = 'NEW_ENTRY' | 'EDIT_INFO' | 'RATE_CHANGE';

// After
type RequestType = 'NEW_ENTRY' | 'EDIT_INFO_SAME_RATE' | 'EDIT_INFO_NEW_RATE';

type PersonnelType =
  | 'CIVIL_SERVANT'
  | 'GOV_EMPLOYEE'
  | 'PH_EMPLOYEE'
  | 'TEMP_EMPLOYEE';

interface WorkAttributes {
  operation?: boolean;      // ปฏิบัติการ
  planning?: boolean;       // วางแผน
  coordination?: boolean;   // ประสานงาน
  service?: boolean;        // บริการ
}

interface PtsRequest {
  request_id: number;
  user_id: number;
  request_type: RequestType;

  // New explicit fields
  personnel_type: PersonnelType | null;
  position_number: string | null;
  department_group: string | null;
  main_duty: string | null;
  work_attributes: WorkAttributes | null;
  requested_amount: number | null;
  effective_date: Date | null;

  // Workflow fields
  current_step: number;
  status: RequestStatus;

  // Legacy field (preserved)
  submission_data: any | null;

  created_at: Date;
  updated_at: Date;
}
```

## Validation Rules

### Required Fields by Request Type

#### NEW_ENTRY
- `personnel_type` - REQUIRED
- `position_number` - REQUIRED
- `department_group` - REQUIRED
- `main_duty` - REQUIRED
- `work_attributes` - REQUIRED
- `requested_amount` - REQUIRED
- `effective_date` - REQUIRED

#### EDIT_INFO_SAME_RATE
- `personnel_type` - OPTIONAL
- `department_group` - OPTIONAL
- Other fields as needed for the edit

#### EDIT_INFO_NEW_RATE
- `requested_amount` - REQUIRED (new rate)
- `effective_date` - REQUIRED (when new rate takes effect)
- Other fields as needed

## Rollback Plan

If you need to rollback this migration:

```sql
-- Remove new columns
ALTER TABLE `pts_requests` DROP COLUMN `personnel_type`;
ALTER TABLE `pts_requests` DROP COLUMN `position_number`;
ALTER TABLE `pts_requests` DROP COLUMN `department_group`;
ALTER TABLE `pts_requests` DROP COLUMN `main_duty`;
ALTER TABLE `pts_requests` DROP COLUMN `work_attributes`;
ALTER TABLE `pts_requests` DROP COLUMN `requested_amount`;
ALTER TABLE `pts_requests` DROP COLUMN `effective_date`;

-- Revert request_type ENUM
ALTER TABLE `pts_requests`
MODIFY COLUMN `request_type` ENUM(
  'NEW_ENTRY',
  'EDIT_INFO',
  'RATE_CHANGE'
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- Drop new indexes
DROP INDEX `idx_pts_requests_personnel_type` ON `pts_requests`;
DROP INDEX `idx_pts_requests_department_group` ON `pts_requests`;
DROP INDEX `idx_pts_requests_effective_date` ON `pts_requests`;
DROP INDEX `idx_pts_requests_amount` ON `pts_requests`;
DROP INDEX `idx_pts_requests_type_status` ON `pts_requests`;
```

## Verification Queries

### Check new columns exist
```sql
DESCRIBE pts_requests;
```

### Check ENUM values
```sql
SELECT COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'pts_requests'
  AND COLUMN_NAME = 'request_type';
```

### Check indexes
```sql
SHOW INDEXES FROM pts_requests;
```

### Sample data query
```sql
SELECT
  request_id,
  request_type,
  personnel_type,
  department_group,
  requested_amount,
  effective_date,
  status
FROM pts_requests
ORDER BY created_at DESC
LIMIT 10;
```

## Next Steps After Migration

1. **Update API Endpoints**
   - Modify POST `/api/requests` to accept new fields
   - Update validation middleware to check new ENUM values
   - Add validation for required fields by request type

2. **Update Frontend Forms**
   - Add dropdown for `personnel_type`
   - Add input fields for position number, department, main duty
   - Add checkboxes for work attributes
   - Add date picker for effective date
   - Add amount input with validation

3. **Data Migration (Optional)**
   - Create script to migrate existing `submission_data` to new columns
   - Validate and clean existing JSON data
   - Update old records to populate explicit fields

4. **Documentation Updates**
   - Update API documentation with new fields
   - Update form validation rules
   - Update user guides with new field requirements

5. **Testing**
   - Test request creation with new fields
   - Test validation for required fields
   - Test backward compatibility with old requests
   - Verify indexes improve query performance

## Support

For issues or questions regarding this migration:
1. Check error logs in the migration script output
2. Verify database connection in `.env`
3. Ensure MySQL 8.0+ compatibility
4. Review foreign key constraints if errors occur

## Author
Database Specialist (DBA Agent) - PHTS Project
