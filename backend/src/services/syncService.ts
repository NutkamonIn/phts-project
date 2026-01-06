import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import db from '../config/database.js';
import redis from '../config/redis.js';

const SALT_ROUNDS = 10;
const SYNC_LOCK_KEY = 'system:sync:lock';
const SYNC_RESULT_KEY = 'system:sync:last_result';
const LOCK_TTL_SECONDS = 300; // 5 minutes
const RESULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// Convert undefined to null for safe DB inserts.
const toNull = (val: any) => (val === undefined ? null : val);

// Check bcrypt hash format ($2a/$2b/$2y).
const isBcryptHash = (str: string): boolean =>
  /^\$2[axy]\$[0-9]{2}\$[A-Za-z0-9./]{53}$/.test(str);

// Detect value change with support for dates and nullish values.
const isChanged = (oldVal: any, newVal: any) => {
  if (oldVal instanceof Date && newVal) {
    return (
      oldVal.toISOString().split('T')[0] !==
      new Date(newVal).toISOString().split('T')[0]
    );
  }
  if (typeof oldVal === 'number' && typeof newVal === 'string') {
    return oldVal !== parseFloat(newVal);
  }
  return String(oldVal ?? '') !== String(newVal ?? '');
};

export class SyncService {
  /**
   * Return cached status (fast path for dashboards).
   */
  static async getLastSyncStatus() {
    const [data, lock] = await Promise.all([
      redis.get(SYNC_RESULT_KEY),
      redis.get(SYNC_LOCK_KEY),
    ]);
    return {
      isSyncing: Boolean(lock),
      lastResult: data ? JSON.parse(data) : null,
    };
  }

  /**
   * Run the full smart sync workflow with distributed lock + status caching.
   */
  static async performFullSync() {
    console.log('[SyncService] Requesting synchronization...');

    const lockValue = `lock:${Date.now()}`;
    const locked = await redis.set(
      SYNC_LOCK_KEY,
      lockValue,
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    if (!locked) {
      console.warn('[SyncService] Synchronization aborted: already in progress.');
      throw new Error('Synchronization is already in progress. Please wait.');
    }

    const startTotal = Date.now();
    const stats = {
      users: { added: 0, updated: 0, skipped: 0 },
      employees: { upserted: 0, skipped: 0 },
      support_employees: { upserted: 0, skipped: 0 },
      signatures: { added: 0, skipped: 0 },
      licenses: { upserted: 0 },
      quotas: { upserted: 0 },
      leaves: { upserted: 0, skipped: 0 },
      movements: { added: 0 },
    };

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Users
      console.log('[SyncService] Processing users...');
      const [existingUsers] = await conn.query<RowDataPacket[]>(
        'SELECT citizen_id, role, is_active, password_hash FROM users',
      );
      const userMap = new Map(existingUsers.map((u) => [u.citizen_id, u]));

      const [viewUsers] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM users_sync_view',
      );

      for (const vUser of viewUsers) {
        const dbUser = userMap.get(vUser.citizen_id);
        let needsUpdate = false;
        let finalPass = vUser.plain_password;
        let shouldHash = true;

        if (!dbUser) {
          stats.users.added++;
          needsUpdate = true;
        } else {
          if (dbUser.role !== vUser.role) needsUpdate = true;
          if (Number(dbUser.is_active) !== Number(vUser.is_active))
            needsUpdate = true;

          if (dbUser.password_hash && dbUser.password_hash.length > 0) {
            shouldHash = false;
            finalPass = dbUser.password_hash;
          } else {
            needsUpdate = true;
          }

          if (!needsUpdate) {
            stats.users.skipped++;
            continue;
          }
          stats.users.updated++;
        }

        if (shouldHash && finalPass && !isBcryptHash(String(finalPass))) {
          finalPass = await bcrypt.hash(String(finalPass), SALT_ROUNDS);
        }

        await conn.execute(
          `
          INSERT INTO users (citizen_id, password_hash, role, is_active)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            password_hash = VALUES(password_hash),
            role = VALUES(role),
            is_active = VALUES(is_active),
            updated_at = NOW()
        `,
          [vUser.citizen_id, finalPass, vUser.role, vUser.is_active],
        );
      }

      // 2. Employees
      console.log('[SyncService] Processing employees...');
      const [existingEmps] = await conn.query<RowDataPacket[]>(
        'SELECT citizen_id, position_name, level, department FROM pts_employees',
      );
      const empMap = new Map(existingEmps.map((e) => [e.citizen_id, e]));

      const [viewEmps] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM employees',
      );

      for (const vEmp of viewEmps) {
        const dbEmp = empMap.get(vEmp.citizen_id);
        if (
          dbEmp &&
          !isChanged(dbEmp.position_name, vEmp.position_name) &&
          !isChanged(dbEmp.level, vEmp.level) &&
          !isChanged(dbEmp.department, vEmp.department)
        ) {
          stats.employees.skipped++;
          continue;
        }

        await conn.execute(
          `
          INSERT INTO pts_employees (
            citizen_id, title, first_name, last_name, sex, birth_date,
            position_name, position_number, level, special_position, emp_type,
            department, sub_department, mission_group, specialist, expert, 
            start_work_date, first_entry_date, original_status, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            position_name = VALUES(position_name),
            level = VALUES(level),
            special_position = VALUES(special_position),
            department = VALUES(department),
            sub_department = VALUES(sub_department),
            specialist = VALUES(specialist),
            expert = VALUES(expert),
            last_synced_at = NOW()
        `,
          [
            vEmp.citizen_id,
            vEmp.title,
            vEmp.first_name,
            vEmp.last_name,
            vEmp.sex,
            vEmp.birth_date,
            vEmp.position_name,
            vEmp.position_number,
            vEmp.level,
            (vEmp.special_position || '').substring(0, 65535),
            vEmp.employee_type,
            vEmp.department,
            vEmp.sub_department,
            vEmp.mission_group,
            vEmp.specialist,
            vEmp.expert,
            vEmp.start_current_position,
            vEmp.first_entry_date,
            vEmp.original_status,
          ],
        );
        stats.employees.upserted++;
      }

      // 2.5 Support Employees (Contract/Government employees)
      console.log('[SyncService] Processing support employees...');

      const [existingSupEmps] = await conn.query<RowDataPacket[]>(
        `SELECT citizen_id, title, first_name, last_name, position_name, 
                level, special_position, emp_type, department, 
                is_currently_active, is_enable_login 
         FROM pts_support_employees`,
      );
      const supEmpMap = new Map(existingSupEmps.map((e) => [e.citizen_id, e]));

      const [viewSupEmps] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM support_employees',
      );

      for (const vSup of viewSupEmps) {
        const dbSup = supEmpMap.get(vSup.citizen_id);

        if (
          dbSup &&
          !isChanged(dbSup.title, vSup.title) &&
          !isChanged(dbSup.first_name, vSup.first_name) &&
          !isChanged(dbSup.last_name, vSup.last_name) &&
          !isChanged(dbSup.position_name, vSup.position_name) &&
          !isChanged(dbSup.level, vSup.level) &&
          !isChanged(dbSup.special_position, vSup.special_position) &&
          !isChanged(dbSup.emp_type, vSup.employee_type) &&
          !isChanged(dbSup.department, vSup.department) &&
          Number(dbSup.is_currently_active) === Number(vSup.is_currently_active) &&
          Number(dbSup.is_enable_login) === Number(vSup.is_enable_login)
        ) {
          stats.support_employees.skipped++;
          continue;
        }

        await conn.execute(
          `
          INSERT INTO pts_support_employees (
            citizen_id, title, first_name, last_name, 
            position_name, level, special_position, emp_type, 
            department, is_currently_active, is_enable_login, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            position_name = VALUES(position_name),
            level = VALUES(level),
            special_position = VALUES(special_position),
            emp_type = VALUES(emp_type),
            department = VALUES(department),
            is_currently_active = VALUES(is_currently_active),
            is_enable_login = VALUES(is_enable_login),
            last_synced_at = NOW()
        `,
          [
            toNull(vSup.citizen_id),
            toNull(vSup.title),
            toNull(vSup.first_name),
            toNull(vSup.last_name),
            toNull(vSup.position_name),
            toNull(vSup.level),
            toNull(vSup.special_position),
            toNull(vSup.employee_type),
            toNull(vSup.department),
            toNull(vSup.is_currently_active),
            toNull(vSup.is_enable_login),
          ],
        );
        stats.support_employees.upserted++;
      }

      // 3. Signatures
      console.log('[SyncService] Processing signatures...');
      const [existingSigs] = await conn.query<RowDataPacket[]>(
        'SELECT user_id FROM pts_user_signatures',
      );
      const sigSet = new Set(existingSigs.map((s) => s.user_id));

      const [viewSigs] = await conn.query<RowDataPacket[]>(
        `
        SELECT u.id as user_id, s.signature_blob 
        FROM employee_signatures s 
        JOIN users u ON CONVERT(s.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `,
      );

      for (const vSig of viewSigs) {
        if (sigSet.has(vSig.user_id)) {
          stats.signatures.skipped++;
          continue;
        }
        await conn.execute(
          `
          INSERT INTO pts_user_signatures (user_id, signature_image, updated_at) VALUES (?, ?, NOW())
        `,
          [vSig.user_id, vSig.signature_blob],
        );
        stats.signatures.added++;
      }

      // 4. Licenses & Quotas
      console.log('[SyncService] Processing licenses and quotas...');
      await conn.query(`
        INSERT INTO pts_employee_licenses (citizen_id, license_no, valid_from, valid_until, status, synced_at)
        SELECT l.citizen_id, l.license_no, l.valid_from, l.valid_until, l.status, NOW()
        FROM employee_licenses l
        JOIN users u ON CONVERT(l.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
        ON DUPLICATE KEY UPDATE valid_from=VALUES(valid_from), valid_until=VALUES(valid_until), status=VALUES(status), synced_at=NOW()
      `);

      const [viewQuotas] = await conn.query<RowDataPacket[]>(
        `
        SELECT q.citizen_id, q.fiscal_year, q.total_quota
        FROM leave_quotas q
        JOIN users u ON CONVERT(q.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `,
      );
      for (const q of viewQuotas) {
        await conn.execute(
          `
          INSERT INTO pts_leave_quotas (citizen_id, fiscal_year, quota_vacation, updated_at)
          VALUES (?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE quota_vacation = VALUES(quota_vacation), updated_at = NOW()
        `,
          [q.citizen_id, q.fiscal_year, q.total_quota],
        );
        stats.quotas.upserted++;
      }

      // 5. Leave Requests
      console.log('[SyncService] Processing leave requests...');
      const [existingLeaves] = await conn.query<RowDataPacket[]>(
        'SELECT ref_id, status, start_date, end_date FROM pts_leave_requests WHERE ref_id IS NOT NULL',
      );
      const leaveMap = new Map(existingLeaves.map((l) => [l.ref_id, l]));

      const [viewLeaves] = await conn.query<RowDataPacket[]>(
        `
        SELECT lr.* FROM leave_requests lr
        JOIN users u ON CONVERT(lr.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `,
      );

      for (const vLeave of viewLeaves) {
        if (!vLeave.ref_id) continue;
        const dbLeave = leaveMap.get(vLeave.ref_id);

        if (dbLeave) {
          const dateChanged =
            isChanged(dbLeave.start_date, vLeave.start_date) ||
            isChanged(dbLeave.end_date, vLeave.end_date);
          const statusChanged = isChanged(dbLeave.status, vLeave.status);
          if (!dateChanged && !statusChanged) {
            stats.leaves.skipped++;
            continue;
          }
        }

        await conn.execute(
          `
          INSERT INTO pts_leave_requests (
            ref_id, citizen_id, leave_type, start_date, end_date, 
            duration_days, fiscal_year, remark, status, synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            start_date = VALUES(start_date),
            end_date = VALUES(end_date),
            duration_days = VALUES(duration_days),
            synced_at = NOW()
        `,
          [
            toNull(vLeave.ref_id),
            toNull(vLeave.citizen_id),
            toNull(vLeave.leave_type),
            toNull(vLeave.start_date),
            toNull(vLeave.end_date),
            toNull(vLeave.duration_days),
            toNull(vLeave.fiscal_year),
            toNull(vLeave.remark),
            toNull(vLeave.status),
          ],
        );
        stats.leaves.upserted++;
      }

      // 6. Movements
      console.log('[SyncService] Processing movements...');
      await conn.query(`
        INSERT IGNORE INTO pts_employee_movements (citizen_id, movement_type, effective_date, remark, synced_at)
        SELECT m.citizen_id, m.movement_type, m.effective_date, m.remark, NOW()
        FROM employee_movements m
        JOIN users u ON CONVERT(m.citizen_id USING utf8mb4) COLLATE utf8mb4_unicode_ci = u.citizen_id
      `);

      await conn.commit();

      const duration = ((Date.now() - startTotal) / 1000).toFixed(2);
      const resultData = {
        success: true,
        duration,
        stats,
        timestamp: new Date().toISOString(),
      };

      console.log(`[SyncService] Synchronization completed in ${duration}s`);

      await redis.set(
        SYNC_RESULT_KEY,
        JSON.stringify(resultData),
        'EX',
        RESULT_TTL_SECONDS,
      );

      return resultData;
    } catch (error) {
      await conn.rollback();
      console.error('[SyncService] Synchronization failed:', error);
      throw error;
    } finally {
      await SyncService.releaseLock(lockValue);
      conn.release();
    }
  }

  private static async releaseLock(lockValue: string) {
    try {
      const current = await redis.get(SYNC_LOCK_KEY);
      if (current === lockValue) {
        await redis.del(SYNC_LOCK_KEY);
      }
    } catch (err) {
      console.error('[SyncService] Failed to release sync lock:', err);
    }
  }
}
