# PTS Requests Schema Update V2 - Documentation

## Overview

This update enhances the `pts_requests` table to match the official Thai P.T.S. (Professional Talent System) paper form used by government healthcare facilities. The changes ensure full compliance with government documentation requirements.

**Date:** 2025-12-31
**Migration Script:** `src/scripts/update_requests_schema_v2.ts`
**Schema File:** `src/database/init_requests.sql`

---

## What Changed

### New Columns Added

| Column Name | Data Type | Description | Thai Label |
|-------------|-----------|-------------|------------|
| `personnel_type` | ENUM | Employee classification type | ประเภทบุคลากร |
| `position_number` | VARCHAR(50) | Government position ID | เลขที่ตำแหน่ง |
| `department_group` | VARCHAR(100) | Department/work group | กลุ่มงาน/แผนก |
| `main_duty` | VARCHAR(100) | Primary job responsibility | หน้าที่หลัก |
| `work_attributes` | JSON | 4 work attribute checkboxes | ลักษณะงาน |
| `requested_amount` | DECIMAL(10,2) | Amount requested | ยอดเงินที่ขอ |
| `effective_date` | DATE | Effective date of changes | วันที่มีผล |

### Modified Fields

**`request_type` ENUM values updated:**

| Old Value | New Value | Thai Label | Description |
|-----------|-----------|------------|-------------|
| `NEW_ENTRY` | `NEW_ENTRY` | ขอรับค่าตอบแทนใหม่ | First time application |
| `EDIT_INFO` | `EDIT_INFO_SAME_RATE` | แก้ไขข้อมูล (อัตราเดิม) | Edit info, same rate |
| `RATE_CHANGE` | `EDIT_INFO_NEW_RATE` | แก้ไขข้อมูล (อัตราใหม่) | Edit info, new rate |

### New Indexes

- `idx_pts_requests_personnel_type` - Fast filtering by personnel type
- `idx_pts_requests_effective_date` - Fast filtering by effective date

---

## Field Specifications

### 1. Personnel Type (ประเภทบุคลากร)

**Type:** ENUM
**Required:** YES
**Default:** `CIVIL_SERVANT`

```sql
ENUM('CIVIL_SERVANT', 'GOV_EMPLOYEE', 'PH_EMPLOYEE', 'TEMP_EMPLOYEE')
```

| Value | Thai Label | Description |
|-------|------------|-------------|
| `CIVIL_SERVANT` | ข้าราชการ | Government civil servants |
| `GOV_EMPLOYEE` | พนักงานราชการ | Government employees (non-civil servant) |
| `PH_EMPLOYEE` | พนักงานกระทรวงสาธารณสุข (พกส.) | Ministry of Public Health employees |
| `TEMP_EMPLOYEE` | ลูกจ้างชั่วคราว | Temporary employees |

**Usage Example:**
```typescript
personnel_type: 'CIVIL_SERVANT'
```

---

### 2. Position Number (เลขที่ตำแหน่ง)

**Type:** VARCHAR(50)
**Required:** NO
**Purpose:** Government position identification number

**Usage Example:**
```typescript
position_number: 'PH-001-2024'
```

**Note:** This field is critical for HR tracking and government payroll systems.

---

### 3. Department Group (กลุ่มงาน/แผนก)

**Type:** VARCHAR(100)
**Required:** NO
**Purpose:** Department or work unit classification

**Usage Examples:**
```typescript
department_group: 'กลุ่มงานการพยาบาล'
department_group: 'กลุ่มงานเภสัชกรรม'
department_group: 'กลุ่มงานห้องผ่าตัด'
```

---

### 4. Main Duty (หน้าที่หลัก)

**Type:** VARCHAR(100)
**Required:** NO
**Purpose:** Primary job responsibility

**Usage Examples:**
```typescript
main_duty: 'ดูแลผู้ป่วยวิกฤต'
main_duty: 'จ่ายยา/ตรวจสอบใบสั่งยา'
main_duty: 'ตรวจรักษาผู้ป่วยนอก'
```

---

### 5. Work Attributes (ลักษณะงาน)

**Type:** JSON
**Required:** NO
**Purpose:** 4 checkboxes on official form indicating work nature

**Structure:**
```json
{
  "operation": true,      // ปฏิบัติการ - Operational work
  "planning": false,      // วางแผน - Planning work
  "coordination": true,   // ประสานงาน - Coordination work
  "service": true         // บริการ - Service/patient care work
}
```

**TypeScript Interface:**
```typescript
interface WorkAttributes {
  operation: boolean;    // Operational tasks
  planning: boolean;     // Planning/management
  coordination: boolean; // Coordination with other units
  service: boolean;      // Direct patient care/service
}
```

**Usage Example:**
```typescript
work_attributes: {
  operation: true,
  planning: false,
  coordination: true,
  service: true
}
```

---

### 6. Requested Amount (ยอดเงินที่ขอ)

**Type:** DECIMAL(10,2)
**Required:** NO
**Purpose:** PTS allowance amount requested in Thai Baht

**Usage Examples:**
```typescript
requested_amount: 5000.00  // 5,000 THB
requested_amount: 15000.00 // 15,000 THB
```

**Typical Ranges by Profession:**
- Doctors: 5,000 - 15,000 THB
- Dentists: 5,000 - 10,000 THB
- Pharmacists: 1,500 - 3,000 THB
- Nurses: 1,000 - 2,000 THB
- Allied Health: 1,000 THB

---

### 7. Effective Date (วันที่มีผล)

**Type:** DATE
**Required:** NO
**Purpose:** Date when the PTS changes take effect

**Format:** YYYY-MM-DD

**Usage Example:**
```typescript
effective_date: '2025-01-01'
```

**Business Rules:**
- Usually the 1st of the month
- Cannot be in the past (validation recommended)
- Often aligns with fiscal year start (October 1st in Thailand)

---

## Migration Guide

### For Existing Databases

Run the migration script to add new columns to existing `pts_requests` table:

```bash
# Navigate to backend directory
cd backend

# Run migration
npx ts-node src/scripts/update_requests_schema_v2.ts
```

**Migration is idempotent:** Safe to run multiple times.

### For New Installations

Use the updated `init_requests.sql` file which includes all new fields:

```bash
npx ts-node src/scripts/migrate_requests.ts
```

---

## Verification Queries

### Check Schema Changes

```sql
-- View all columns in pts_requests table
DESCRIBE pts_requests;

-- Check indexes
SHOW INDEXES FROM pts_requests;

-- Verify ENUM values for request_type
SHOW COLUMNS FROM pts_requests LIKE 'request_type';

-- Verify ENUM values for personnel_type
SHOW COLUMNS FROM pts_requests LIKE 'personnel_type';
```

### Sample Query Using New Fields

```sql
SELECT
  request_id,
  user_id,
  personnel_type,
  position_number,
  department_group,
  main_duty,
  work_attributes,
  request_type,
  requested_amount,
  effective_date,
  status,
  current_step
FROM pts_requests
WHERE personnel_type = 'CIVIL_SERVANT'
  AND effective_date >= '2025-01-01'
  AND status = 'PENDING'
ORDER BY created_at DESC;
```

---

## API Integration Notes

### TypeScript Interface (Recommended)

```typescript
// Define request type enum
export enum RequestType {
  NEW_ENTRY = 'NEW_ENTRY',
  EDIT_INFO_SAME_RATE = 'EDIT_INFO_SAME_RATE',
  EDIT_INFO_NEW_RATE = 'EDIT_INFO_NEW_RATE'
}

// Define personnel type enum
export enum PersonnelType {
  CIVIL_SERVANT = 'CIVIL_SERVANT',
  GOV_EMPLOYEE = 'GOV_EMPLOYEE',
  PH_EMPLOYEE = 'PH_EMPLOYEE',
  TEMP_EMPLOYEE = 'TEMP_EMPLOYEE'
}

// Work attributes interface
export interface WorkAttributes {
  operation: boolean;
  planning: boolean;
  coordination: boolean;
  service: boolean;
}

// PTS Request interface
export interface PTSRequest {
  request_id: number;
  user_id: number;

  // Personnel info
  personnel_type: PersonnelType;
  position_number?: string;
  department_group?: string;
  main_duty?: string;

  // Work attributes
  work_attributes?: WorkAttributes;

  // Request details
  request_type: RequestType;
  requested_amount?: number;
  effective_date?: string; // YYYY-MM-DD

  // Workflow
  current_step: number;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'RETURNED';

  // Legacy
  submission_data?: any;

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### Sample API Request Body

```typescript
// POST /api/requests - Create new PTS request
const requestBody = {
  user_id: 123,
  personnel_type: 'CIVIL_SERVANT',
  position_number: 'PH-MED-001',
  department_group: 'กลุ่มงานแพทย์',
  main_duty: 'ตรวจรักษาผู้ป่วยใน ICU',
  work_attributes: {
    operation: true,
    planning: false,
    coordination: true,
    service: true
  },
  request_type: 'NEW_ENTRY',
  requested_amount: 15000.00,
  effective_date: '2025-02-01'
};
```

---

## Rollback Instructions

If you need to revert the schema changes:

```sql
-- Remove new columns
ALTER TABLE pts_requests DROP COLUMN personnel_type;
ALTER TABLE pts_requests DROP COLUMN position_number;
ALTER TABLE pts_requests DROP COLUMN department_group;
ALTER TABLE pts_requests DROP COLUMN main_duty;
ALTER TABLE pts_requests DROP COLUMN work_attributes;
ALTER TABLE pts_requests DROP COLUMN requested_amount;
ALTER TABLE pts_requests DROP COLUMN effective_date;

-- Remove new indexes
DROP INDEX idx_pts_requests_personnel_type ON pts_requests;
DROP INDEX idx_pts_requests_effective_date ON pts_requests;

-- Revert request_type ENUM to old values
ALTER TABLE pts_requests
MODIFY COLUMN request_type ENUM('NEW_ENTRY', 'EDIT_INFO', 'RATE_CHANGE') NOT NULL;
```

**Warning:** This will result in data loss for any requests using the new fields!

---

## Data Migration Considerations

### Existing Records

After running the migration, existing records will have:
- `personnel_type` = `'CIVIL_SERVANT'` (default)
- All other new fields = `NULL`

**Recommendation:** Update existing records with appropriate values:

```sql
-- Example: Update existing records based on employee data
UPDATE pts_requests pr
JOIN users u ON pr.user_id = u.user_id
JOIN employees e ON u.citizen_id = e.citizen_id
SET
  pr.personnel_type = 'CIVIL_SERVANT',  -- Adjust based on employee type
  pr.department_group = e.department,
  pr.position_number = e.position_id
WHERE pr.personnel_type = 'CIVIL_SERVANT'
  AND pr.position_number IS NULL;
```

---

## Testing Checklist

- [ ] Migration script runs successfully without errors
- [ ] All new columns exist in database
- [ ] Indexes are created correctly
- [ ] ENUM values updated for `request_type`
- [ ] Default value for `personnel_type` works
- [ ] JSON validation for `work_attributes` accepts valid structure
- [ ] Existing records still accessible
- [ ] API endpoints updated to handle new fields
- [ ] Frontend forms updated to collect new data
- [ ] Validation rules implemented for required fields
- [ ] Test data created with various personnel types
- [ ] Effective date validation (cannot be in past)
- [ ] Requested amount validation (positive decimal)

---

## Support

For questions or issues related to this schema update:

1. Check the official P.T.S. paper form for field requirements
2. Review the comments in `init_requests.sql`
3. Examine the migration script logic in `update_requests_schema_v2.ts`
4. Refer to the PHTS project documentation in `CLAUDE.md`

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| V1 | 2025-12-30 | Initial schema with basic workflow |
| V2 | 2025-12-31 | Added official form fields for government compliance |

---

## Related Files

- **Migration Script:** `backend/src/scripts/update_requests_schema_v2.ts`
- **Schema Definition:** `backend/src/database/init_requests.sql`
- **Database Config:** `backend/src/config/database.ts`
- **Project Guide:** `CLAUDE.md`
