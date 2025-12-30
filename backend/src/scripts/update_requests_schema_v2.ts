/**
 * PHTS System - PTS Requests Schema Update V2
 *
 * This migration script updates the pts_requests table to match the official Thai P.T.S. paper form
 * by adding specific fields required for government compliance.
 *
 * New Fields Added:
 * - personnel_type: ENUM for employee classification (ประเภทบุคลากร)
 * - position_number: Government position ID (เลขที่ตำแหน่ง)
 * - department_group: Department/work group (กลุ่มงาน/แผนก)
 * - main_duty: Primary job responsibility (หน้าที่หลัก)
 * - work_attributes: JSON for 4 work attribute checkboxes (ลักษณะงาน)
 * - requested_amount: Amount requested in the form (ยอดเงินที่ขอ)
 * - effective_date: Date when changes take effect (วันที่มีผล)
 *
 * Request Type Updated:
 * - Modified ENUM to match 3 checkboxes on official form
 *
 * Usage: npx ts-node src/scripts/update_requests_schema_v2.ts
 *
 * Date: 2025-12-31
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve .env relative to the backend folder so it works from any cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

/**
 * Helper function to check if a column exists in a table
 */
async function columnExists(
  connection: mysql.Connection,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [process.env.DB_NAME || 'phts_system', tableName, columnName]
  );
  return rows[0].count > 0;
}

/**
 * Helper function to check if an index exists
 */
async function indexExists(
  connection: mysql.Connection,
  tableName: string,
  indexName: string
): Promise<boolean> {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [process.env.DB_NAME || 'phts_system', tableName, indexName]
  );
  return rows[0].count > 0;
}

/**
 * Main migration function
 */
async function updateSchema(): Promise<void> {
  let connection: mysql.Connection | null = null;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'phts_system',
    });

    console.log('\n========================================');
    console.log('PTS Requests Schema Update V2');
    console.log('========================================\n');

    // 1. Add personnel_type column
    console.log('[1/9] Checking personnel_type column...');
    if (!(await columnExists(connection, 'pts_requests', 'personnel_type'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN personnel_type ENUM('CIVIL_SERVANT', 'GOV_EMPLOYEE', 'PH_EMPLOYEE', 'TEMP_EMPLOYEE')
        NOT NULL DEFAULT 'CIVIL_SERVANT'
        COMMENT 'ประเภทบุคลากร: ข้าราชการ/พนักงานราชการ/พกส./ลูกจ้าง'
        AFTER user_id
      `);
      console.log('  ✓ Added personnel_type column');
    } else {
      console.log('  - personnel_type column already exists');
    }

    // 2. Add position_number column
    console.log('[2/9] Checking position_number column...');
    if (!(await columnExists(connection, 'pts_requests', 'position_number'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN position_number VARCHAR(50) NULL
        COMMENT 'เลขที่ตำแหน่ง'
        AFTER personnel_type
      `);
      console.log('  ✓ Added position_number column');
    } else {
      console.log('  - position_number column already exists');
    }

    // 3. Add department_group column
    console.log('[3/9] Checking department_group column...');
    if (!(await columnExists(connection, 'pts_requests', 'department_group'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN department_group VARCHAR(100) NULL
        COMMENT 'กลุ่มงาน/แผนก'
        AFTER position_number
      `);
      console.log('  ✓ Added department_group column');
    } else {
      console.log('  - department_group column already exists');
    }

    // 4. Add main_duty column
    console.log('[4/9] Checking main_duty column...');
    if (!(await columnExists(connection, 'pts_requests', 'main_duty'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN main_duty VARCHAR(100) NULL
        COMMENT 'หน้าที่หลัก'
        AFTER department_group
      `);
      console.log('  ✓ Added main_duty column');
    } else {
      console.log('  - main_duty column already exists');
    }

    // 5. Add work_attributes column
    console.log('[5/9] Checking work_attributes column...');
    if (!(await columnExists(connection, 'pts_requests', 'work_attributes'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN work_attributes JSON NULL
        COMMENT 'ลักษณะงาน: {operation, planning, coordination, service}'
        AFTER main_duty
      `);
      console.log('  ✓ Added work_attributes column');
    } else {
      console.log('  - work_attributes column already exists');
    }

    // 6. Add requested_amount column
    console.log('[6/9] Checking requested_amount column...');
    if (!(await columnExists(connection, 'pts_requests', 'requested_amount'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN requested_amount DECIMAL(10,2) NULL
        COMMENT 'ยอดเงินที่ขอ'
        AFTER work_attributes
      `);
      console.log('  ✓ Added requested_amount column');
    } else {
      console.log('  - requested_amount column already exists');
    }

    // 7. Add effective_date column
    console.log('[7/9] Checking effective_date column...');
    if (!(await columnExists(connection, 'pts_requests', 'effective_date'))) {
      await connection.query(`
        ALTER TABLE pts_requests
        ADD COLUMN effective_date DATE NULL
        COMMENT 'วันที่มีผล'
        AFTER requested_amount
      `);
      console.log('  ✓ Added effective_date column');
    } else {
      console.log('  - effective_date column already exists');
    }

    // 8. Modify request_type ENUM
    console.log('[8/9] Updating request_type ENUM values...');
    await connection.query(`
      ALTER TABLE pts_requests
      MODIFY COLUMN request_type ENUM('NEW_ENTRY', 'EDIT_INFO_SAME_RATE', 'EDIT_INFO_NEW_RATE')
      NOT NULL
      COMMENT 'ประเภทคำขอ: ขอใหม่/แก้ไขอัตราเดิม/แก้ไขอัตราใหม่'
    `);
    console.log('  ✓ Updated request_type ENUM');

    // 9. Add indexes
    console.log('[9/9] Adding indexes...');

    if (!(await indexExists(connection, 'pts_requests', 'idx_pts_requests_personnel_type'))) {
      await connection.query(`
        CREATE INDEX idx_pts_requests_personnel_type ON pts_requests(personnel_type)
      `);
      console.log('  ✓ Added idx_pts_requests_personnel_type index');
    } else {
      console.log('  - idx_pts_requests_personnel_type index already exists');
    }

    if (!(await indexExists(connection, 'pts_requests', 'idx_pts_requests_effective_date'))) {
      await connection.query(`
        CREATE INDEX idx_pts_requests_effective_date ON pts_requests(effective_date)
      `);
      console.log('  ✓ Added idx_pts_requests_effective_date index');
    } else {
      console.log('  - idx_pts_requests_effective_date index already exists');
    }

    console.log('\n========================================');
    console.log('✓ Schema updated successfully!');
    console.log('========================================\n');

    // Display summary
    console.log('Summary of Changes:');
    console.log('-------------------');
    console.log('New Columns:');
    console.log('  - personnel_type (ENUM)');
    console.log('  - position_number (VARCHAR)');
    console.log('  - department_group (VARCHAR)');
    console.log('  - main_duty (VARCHAR)');
    console.log('  - work_attributes (JSON)');
    console.log('  - requested_amount (DECIMAL)');
    console.log('  - effective_date (DATE)');
    console.log('\nUpdated:');
    console.log('  - request_type ENUM values');
    console.log('\nNew Indexes:');
    console.log('  - idx_pts_requests_personnel_type');
    console.log('  - idx_pts_requests_effective_date\n');

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
      console.log('Database connection closed.\n');
    }
  }
}

// Run migration
updateSchema()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
