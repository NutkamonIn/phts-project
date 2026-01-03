import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Config เชื่อมต่อฐานข้อมูล
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'phts_system',
  port: parseInt(process.env.DB_PORT || '3306', 10),
};

const SALT_ROUNDS = 10;
const ALLOWED_ROLES = new Set([
  'USER',
  'ADMIN',
  'HEAD_DEPT',
  'OFFICER',
  'HEAD_HR',
  'DIRECTOR',
  'FINANCE',
]);

function normalizeRole(rawRole: any): string {
  if (!rawRole) return 'USER';
  const role = rawRole.toString().trim().toUpperCase();
  return ALLOWED_ROLES.has(role) ? role : 'USER';
}

function truncateField(value: any, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = value.toString();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

async function syncAll() {
  console.log('🚀 Starting Master Synchronization (V3.0 Schema Compatible)...');
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    // ==========================================
    // PHASE 1: Sync User Accounts (Login Data)
    // ==========================================
    // ส่วนนี้จัดการเรื่อง Login (citizen_id/password)
    console.log('\n🔐 Phase 1: Syncing User Accounts (Auth)...');

    const [viewUsers]: any[] = await connection.query(`SELECT * FROM users_sync_view`);

    const activeCitizenIds: string[] = [];
    let updatedUsers = 0;

    for (const u of viewUsers) {
      activeCitizenIds.push(u.citizen_id);
      let finalHash = u.plain_password;

      // Hash password ถ้ายังเป็น Plain text
      if (
        u.plain_password &&
        (!u.plain_password.startsWith('$2') || u.plain_password.length < 50)
      ) {
        finalHash = await bcrypt.hash(String(u.plain_password), SALT_ROUNDS);
      }

      // Default role เป็น USER ไปก่อน ถ้ามี logic ปรับ role ค่อยว่ากัน
      const role = normalizeRole(u.role);

      await connection.query(
        `
        INSERT INTO users (citizen_id, password_hash, role, created_at, updated_at)
        VALUES (?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          updated_at = NOW()
      `,
        [u.citizen_id, finalHash, role],
      );
      updatedUsers++;
    }
    console.log(`   ✅ Synced ${updatedUsers} user accounts.`);

    // ==========================================
    // PHASE 2: Sync Medical Profiles (pts_employees)
    // ==========================================
    // ส่วนนี้สำคัญที่สุด: ดึงข้อมูลเพื่อใช้จัดกลุ่ม (Classification)
    console.log('\n👩‍⚕️ Phase 2: Syncing Employee Profiles from View `employees`...');

    // ดึงข้อมูลจาก View ที่คุณสร้างไว้ใน logic.sql
    // เราจะดึงเฉพาะคนที่มี User Account แล้ว (Active Users) เพื่อความสอดคล้อง
    const [empData]: any[] = await connection.query(`
      SELECT * FROM employees
      WHERE citizen_id IN (SELECT citizen_id FROM users)
    `);

    let syncedProfiles = 0;

    for (const e of empData) {
      // Map ข้อมูลจาก View (Source) -> Table ใหม่ (Destination)
      // View Field: employee_type -> Table: emp_type
      // View Field: start_current_position -> Table: start_work_date

      await connection.query(
        `
        INSERT INTO pts_employees
        (
          citizen_id,
          title, first_name, last_name,
          sex, birth_date,
          position_name, position_number, level, special_position,
          emp_type, mission_group, department, sub_department,
          specialist, expert,
          start_work_date, first_entry_date, original_status,
          last_synced_at
        )
        VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, NOW()
        )
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          first_name = VALUES(first_name),
          last_name = VALUES(last_name),
          sex = VALUES(sex),
          birth_date = VALUES(birth_date),
          position_name = VALUES(position_name),
          position_number = VALUES(position_number),
          level = VALUES(level),
          special_position = VALUES(special_position),
          emp_type = VALUES(emp_type),
          mission_group = VALUES(mission_group),
          department = VALUES(department),
          sub_department = VALUES(sub_department),
          specialist = VALUES(specialist),
          expert = VALUES(expert),
          start_work_date = VALUES(start_work_date),
          first_entry_date = VALUES(first_entry_date),
          original_status = VALUES(original_status),
          last_synced_at = NOW()
      `,
        [
          e.citizen_id,
          e.title,
          e.first_name,
          e.last_name,
          e.sex,
          e.birth_date,
          e.position_name,
          e.position_number,
          e.level,
          truncateField(e.special_position, 100),
          e.employee_type, // Map to emp_type
          e.mission_group,
          e.department,
          e.sub_department, // สำคัญ: ใช้แยก Ward/Unit
          e.specialist, // สำคัญ: ใช้แยกแพทย์เฉพาะทาง
          e.expert, // สำคัญ: ใช้แยกคุณสมบัติพิเศษ (ป.โท/เอก)
          e.start_current_position, // Map to start_work_date
          e.first_entry_date,
          e.original_status,
        ],
      );
      syncedProfiles++;
    }
    console.log(`   ✅ Synced ${syncedProfiles} employee profiles with classification data.`);

    // ==========================================
    // PHASE 3: Sync Support Profiles (Optional)
    // ==========================================
    // ถ้ามี View สำหรับสายสนับสนุนแยกต่างหาก ก็ทำคล้ายๆ กัน
    // แต่จาก logic.sql ดูเหมือน View `employees` จะรวมทุกวิชาชีพไว้แล้ว
    // ดังนั้นอาจจะไม่ต้องทำ Phase 3 แยก หรือทำเฉพาะกลุ่มที่ไม่อยู่ใน `employees` view

    console.log('\n✨ Database Synchronization Completed!');
  } catch (error: any) {
    console.error('\n❌ Sync Failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (connection) await connection.end();
  }
}

// Run the script
syncAll();
