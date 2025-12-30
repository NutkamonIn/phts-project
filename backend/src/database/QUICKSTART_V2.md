# Quick Start Guide - pts_requests Schema v2 Migration

## TL;DR - Run Migration Now

```bash
cd backend
npm run migrate:update-schema
```

That's it! The migration is idempotent and safe to run multiple times.

---

## What This Migration Does

Adds 7 new explicit columns to `pts_requests` table to match the official Thai P.T.S. form:

1. `personnel_type` - Employee classification (ประเภทบุคลากร)
2. `position_number` - Position ID (เลขที่ตำแหน่ง)
3. `department_group` - Department/Unit (กลุ่มงาน/แผนก)
4. `main_duty` - Primary responsibility (หน้าที่หลัก)
5. `work_attributes` - Work characteristics (ลักษณะงาน)
6. `requested_amount` - PTS amount requested (ยอดเงินที่ขอ)
7. `effective_date` - When it takes effect (วันที่มีผล)

Also updates `request_type` ENUM values to split edit types by rate impact.

---

## Prerequisites

- [x] MySQL 8.0+ running
- [x] Database `phts_system` exists
- [x] Table `pts_requests` already created
- [x] `.env` configured with DB credentials
- [x] Node.js 18+ installed

---

## Step-by-Step Execution

### 1. Backup Your Database (Recommended)

```bash
mysqldump -u root -p phts_system pts_requests > pts_requests_backup.sql
```

### 2. Run the Migration

```bash
cd backend
npm run migrate:update-schema
```

### 3. Verify Success

Look for this output:

```
✓ All 7 new columns verified
✓ request_type ENUM updated successfully
✓ All 5 indexes verified

Migration Completed Successfully
```

### 4. Check the Database

```bash
mysql -u root -p phts_system
```

```sql
DESCRIBE pts_requests;
```

You should see 15 columns (8 original + 7 new).

---

## Verification Queries

Run these quick checks:

```sql
-- Check columns
SELECT COUNT(*) FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'pts_requests' AND TABLE_SCHEMA = 'phts_system';
-- Expected: 15

-- Check ENUM values
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_NAME = 'pts_requests' AND COLUMN_NAME = 'request_type';
-- Expected: enum('NEW_ENTRY','EDIT_INFO_SAME_RATE','EDIT_INFO_NEW_RATE')

-- Check indexes
SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS
WHERE TABLE_NAME = 'pts_requests' AND TABLE_SCHEMA = 'phts_system';
-- Expected: 9
```

---

## What If Something Goes Wrong?

### Migration Script Fails

1. Check error message in console
2. Verify database connection in `.env`
3. Ensure `pts_requests` table exists
4. Check MySQL version (must be 8.0+)

### Rollback (if needed)

```sql
-- Remove new columns
ALTER TABLE pts_requests DROP COLUMN personnel_type;
ALTER TABLE pts_requests DROP COLUMN position_number;
ALTER TABLE pts_requests DROP COLUMN department_group;
ALTER TABLE pts_requests DROP COLUMN main_duty;
ALTER TABLE pts_requests DROP COLUMN work_attributes;
ALTER TABLE pts_requests DROP COLUMN requested_amount;
ALTER TABLE pts_requests DROP COLUMN effective_date;

-- Revert ENUM
ALTER TABLE pts_requests
MODIFY COLUMN request_type ENUM('NEW_ENTRY','EDIT_INFO','RATE_CHANGE') NOT NULL;
```

---

## After Migration - Update Your Code

### 1. TypeScript Interfaces

```typescript
// Update this
type RequestType = 'NEW_ENTRY' | 'EDIT_INFO' | 'RATE_CHANGE';

// To this
type RequestType = 'NEW_ENTRY' | 'EDIT_INFO_SAME_RATE' | 'EDIT_INFO_NEW_RATE';

// Add this
type PersonnelType = 'CIVIL_SERVANT' | 'GOV_EMPLOYEE' | 'PH_EMPLOYEE' | 'TEMP_EMPLOYEE';

interface WorkAttributes {
  operation?: boolean;
  planning?: boolean;
  coordination?: boolean;
  service?: boolean;
}
```

### 2. API Endpoints

```typescript
// POST /api/requests - Accept new fields
app.post('/api/requests', async (req, res) => {
  const {
    request_type,
    personnel_type,
    position_number,
    department_group,
    main_duty,
    work_attributes,
    requested_amount,
    effective_date,
  } = req.body;

  // Insert with new columns
  await db.query(
    `INSERT INTO pts_requests (
      user_id, request_type, personnel_type, position_number,
      department_group, main_duty, work_attributes,
      requested_amount, effective_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, request_type, personnel_type, position_number,
     department_group, main_duty, JSON.stringify(work_attributes),
     requested_amount, effective_date]
  );
});
```

### 3. Frontend Forms

Add these fields to your request submission form:

```typescript
// Personnel Type dropdown
<select name="personnel_type">
  <option value="CIVIL_SERVANT">ข้าราชการ</option>
  <option value="GOV_EMPLOYEE">พนักงานราชการ</option>
  <option value="PH_EMPLOYEE">พนักงานกระทรวงสาธารณสุข</option>
  <option value="TEMP_EMPLOYEE">ลูกจ้างชั่วคราว</option>
</select>

// Work attributes checkboxes
<input type="checkbox" name="work_attributes.operation" /> ปฏิบัติการ
<input type="checkbox" name="work_attributes.planning" /> วางแผน
<input type="checkbox" name="work_attributes.coordination" /> ประสานงาน
<input type="checkbox" name="work_attributes.service" /> บริการ

// Amount input
<input type="number" name="requested_amount" step="0.01" />

// Date picker
<input type="date" name="effective_date" />
```

---

## Testing Checklist

After migration, test these scenarios:

- [ ] Create NEW_ENTRY request with all new fields
- [ ] Create EDIT_INFO_SAME_RATE request
- [ ] Create EDIT_INFO_NEW_RATE request
- [ ] Query requests by personnel_type (check performance)
- [ ] Query requests by department_group
- [ ] Filter by effective_date range
- [ ] Sort by requested_amount
- [ ] Verify old records still display correctly
- [ ] Verify work_attributes JSON parses correctly
- [ ] Check indexes are used (EXPLAIN queries)

---

## Performance Benefits

### Before (JSON query)
```sql
-- Full table scan - SLOW
SELECT * FROM pts_requests
WHERE JSON_EXTRACT(submission_data, '$.personnel_type') = 'CIVIL_SERVANT';
```

### After (Indexed column)
```sql
-- Index seek - FAST (10-100x faster)
SELECT * FROM pts_requests
WHERE personnel_type = 'CIVIL_SERVANT';
```

---

## Common Queries After Migration

### Find all requests by personnel type
```sql
SELECT * FROM pts_requests
WHERE personnel_type = 'CIVIL_SERVANT'
ORDER BY created_at DESC;
```

### Upcoming effective dates
```sql
SELECT user_id, department_group, requested_amount, effective_date
FROM pts_requests
WHERE effective_date >= CURDATE()
  AND status = 'APPROVED'
ORDER BY effective_date ASC;
```

### Average amount by department
```sql
SELECT
  department_group,
  COUNT(*) as total_requests,
  AVG(requested_amount) as avg_amount,
  SUM(requested_amount) as total_amount
FROM pts_requests
WHERE requested_amount IS NOT NULL
GROUP BY department_group
ORDER BY total_amount DESC;
```

### Requests with specific work attributes
```sql
SELECT * FROM pts_requests
WHERE JSON_EXTRACT(work_attributes, '$.operation') = true
  AND JSON_EXTRACT(work_attributes, '$.service') = true;
```

---

## Files Created

| File | Purpose | Size |
|------|---------|------|
| `alter_requests_v2.sql` | Raw SQL migration script | 6.3 KB |
| `update_requests_schema.ts` | TypeScript migration executor | 16 KB |
| `verify_schema_v2.sql` | Verification queries | 8.0 KB |
| `MIGRATION_GUIDE_V2.md` | Comprehensive guide | 15 KB |
| `SCHEMA_COMPARISON.md` | Before/after comparison | 12 KB |
| `QUICKSTART_V2.md` | This file | 5 KB |

**Total:** 6 files, ~62 KB of documentation

---

## NPM Scripts Added

```json
{
  "scripts": {
    "migrate:requests": "tsx src/scripts/migrate_requests.ts",
    "migrate:update-schema": "tsx src/scripts/update_requests_schema.ts"
  }
}
```

---

## Key Points to Remember

1. **Safe to run multiple times** - Uses `IF NOT EXISTS` clauses
2. **No data loss** - All new columns are NULL-able
3. **Backward compatible** - `submission_data` is preserved
4. **Better performance** - Indexed columns replace JSON queries
5. **Type safety** - ENUM validation at database level

---

## Support Resources

- **Migration Guide:** `MIGRATION_GUIDE_V2.md` - Full documentation
- **Schema Comparison:** `SCHEMA_COMPARISON.md` - Visual before/after
- **Verification SQL:** `verify_schema_v2.sql` - 15+ check queries
- **Raw SQL:** `alter_requests_v2.sql` - Direct database execution

---

## Success Indicators

You'll know the migration succeeded when:

✓ Script completes without errors
✓ `DESCRIBE pts_requests` shows 15 columns
✓ New ENUM values appear in `request_type`
✓ 5 new indexes visible in `SHOW INDEXES`
✓ Existing data remains intact
✓ Application continues to work

---

## Next Steps

1. Run migration in development: `npm run migrate:update-schema`
2. Update TypeScript interfaces
3. Update API validation middleware
4. Update frontend forms
5. Test thoroughly
6. Run migration in staging
7. Run migration in production

---

**Ready to migrate? Run this command:**

```bash
npm run migrate:update-schema
```

Good luck!
