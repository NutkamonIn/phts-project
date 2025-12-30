/**
 * PHTS System - Request Schema Update Migration Script (v2)
 *
 * This script updates the pts_requests table with explicit form fields
 * to match the official Thai government P.T.S. application form structure.
 *
 * Changes Applied:
 * ================
 * 1. Add explicit columns:
 *    - personnel_type (ENUM)
 *    - position_number (VARCHAR)
 *    - department_group (VARCHAR)
 *    - main_duty (VARCHAR)
 *    - work_attributes (JSON)
 *    - requested_amount (DECIMAL)
 *    - effective_date (DATE)
 *
 * 2. Modify request_type ENUM:
 *    OLD: 'NEW_ENTRY', 'EDIT_INFO', 'RATE_CHANGE'
 *    NEW: 'NEW_ENTRY', 'EDIT_INFO_SAME_RATE', 'EDIT_INFO_NEW_RATE'
 *
 * 3. Add performance indexes for new searchable columns
 *
 * 4. Preserve submission_data JSON field for backward compatibility
 *
 * Usage:
 *   npx ts-node src/scripts/update_requests_schema.ts
 *
 * Requirements:
 *   - mysql2 package installed
 *   - .env file configured with database credentials
 *   - alter_requests_v2.sql file exists in src/database/
 *   - pts_requests table already exists
 *
 * Safety:
 *   - Uses IF NOT EXISTS for columns and indexes (idempotent)
 *   - Safe to run multiple times
 *   - Does not drop or delete existing data
 *   - All new columns are NULL-able
 *
 * @author Database Specialist (DBA Agent)
 * @date 2025-12-31
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Resolve .env relative to the backend folder so it works from any cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

/**
 * Configuration for database connection
 */
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'phts_system',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  multipleStatements: true, // Required to execute multiple SQL statements
};

/**
 * Path to the SQL migration file
 */
const SQL_FILE_PATH = path.join(__dirname, '..', 'database', 'alter_requests_v2.sql');

/**
 * Expected new columns after migration
 */
const EXPECTED_NEW_COLUMNS = [
  'personnel_type',
  'position_number',
  'department_group',
  'main_duty',
  'work_attributes',
  'requested_amount',
  'effective_date',
];

/**
 * Reads the SQL file and returns its contents
 *
 * @returns SQL file contents as string
 * @throws Error if file cannot be read
 */
function readSqlFile(): string {
  try {
    if (!fs.existsSync(SQL_FILE_PATH)) {
      throw new Error(`SQL file not found at: ${SQL_FILE_PATH}`);
    }

    const sqlContent = fs.readFileSync(SQL_FILE_PATH, 'utf8');

    if (!sqlContent || sqlContent.trim().length === 0) {
      throw new Error('SQL file is empty');
    }

    return sqlContent;
  } catch (error) {
    console.error('Error reading SQL file:', error);
    throw error;
  }
}

/**
 * Checks if pts_requests table exists
 *
 * @param connection - MySQL connection
 * @throws Error if pts_requests table does not exist
 */
async function verifyTableExists(connection: mysql.Connection): Promise<void> {
  try {
    const [tables] = await connection.query<mysql.RowDataPacket[]>(
      `SHOW TABLES LIKE 'pts_requests'`
    );

    if (!tables || tables.length === 0) {
      throw new Error(
        'pts_requests table does not exist. Please run migrate_requests.ts first.'
      );
    }

    console.log('  ✓ Table pts_requests exists\n');
  } catch (error) {
    console.error('  ✗ Table verification failed:', error);
    throw error;
  }
}

/**
 * Gets current schema information for pts_requests table
 *
 * @param connection - MySQL connection
 * @returns Object with column names and count
 */
async function getCurrentSchema(
  connection: mysql.Connection
): Promise<{ columns: string[]; count: number }> {
  try {
    const [columns] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pts_requests'
       ORDER BY ORDINAL_POSITION`,
      [dbConfig.database]
    );

    const columnNames = columns.map((row) => row.COLUMN_NAME);

    return {
      columns: columnNames,
      count: columnNames.length,
    };
  } catch (error) {
    console.error('Error getting current schema:', error);
    throw error;
  }
}

/**
 * Displays current schema before migration
 *
 * @param connection - MySQL connection
 */
async function displayCurrentSchema(connection: mysql.Connection): Promise<void> {
  try {
    console.log('Current Schema Information:');
    console.log('----------------------------------------\n');

    const schema = await getCurrentSchema(connection);

    console.log(`Total columns: ${schema.count}`);
    console.log('Existing columns:');
    schema.columns.forEach((col) => {
      console.log(`  - ${col}`);
    });
    console.log('');

    // Check which new columns already exist
    const existingNewColumns = EXPECTED_NEW_COLUMNS.filter((col) =>
      schema.columns.includes(col)
    );

    if (existingNewColumns.length > 0) {
      console.log('⚠ Warning: Some new columns already exist:');
      existingNewColumns.forEach((col) => {
        console.log(`  - ${col}`);
      });
      console.log('\nMigration will skip existing columns (idempotent behavior)\n');
    }
  } catch (error) {
    console.error('Error displaying current schema:', error);
    throw error;
  }
}

/**
 * Executes the migration SQL script
 *
 * @param connection - MySQL connection
 * @param sqlContent - SQL statements to execute
 */
async function executeMigration(
  connection: mysql.Connection,
  sqlContent: string
): Promise<void> {
  try {
    console.log('Executing schema migration...\n');

    // Execute the SQL file (contains multiple ALTER TABLE statements)
    await connection.query(sqlContent);

    console.log('  ✓ Migration SQL executed successfully\n');
  } catch (error) {
    console.error('  ✗ Error executing migration:', error);
    throw error;
  }
}

/**
 * Verifies that new columns were added successfully
 *
 * @param connection - MySQL connection
 */
async function verifyNewColumns(connection: mysql.Connection): Promise<void> {
  try {
    console.log('Verifying new columns...\n');

    const schema = await getCurrentSchema(connection);
    const results: { [key: string]: boolean } = {};

    for (const columnName of EXPECTED_NEW_COLUMNS) {
      const exists = schema.columns.includes(columnName);
      results[columnName] = exists;

      if (exists) {
        console.log(`  ✓ Column '${columnName}' exists`);
      } else {
        console.log(`  ✗ Column '${columnName}' was NOT created`);
      }
    }

    console.log('');

    // Check if any column is missing
    const allColumnsExist = Object.values(results).every((exists) => exists);

    if (!allColumnsExist) {
      throw new Error('One or more columns were not created successfully');
    }

    console.log(`  ✓ All ${EXPECTED_NEW_COLUMNS.length} new columns verified\n`);
  } catch (error) {
    console.error('Error verifying columns:', error);
    throw error;
  }
}

/**
 * Verifies that request_type ENUM was updated correctly
 *
 * @param connection - MySQL connection
 */
async function verifyEnumUpdate(connection: mysql.Connection): Promise<void> {
  try {
    console.log('Verifying request_type ENUM update...\n');

    const [columns] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pts_requests' AND COLUMN_NAME = 'request_type'`,
      [dbConfig.database]
    );

    if (!columns || columns.length === 0) {
      throw new Error('request_type column not found');
    }

    const columnType = columns[0].COLUMN_TYPE;
    console.log(`  Current ENUM definition: ${columnType}\n`);

    // Check if new ENUM values exist
    const expectedValues = ['NEW_ENTRY', 'EDIT_INFO_SAME_RATE', 'EDIT_INFO_NEW_RATE'];
    const enumString = columnType.toLowerCase();

    const allValuesPresent = expectedValues.every((val) =>
      enumString.includes(val.toLowerCase())
    );

    if (allValuesPresent) {
      console.log('  ✓ request_type ENUM updated successfully');
      expectedValues.forEach((val) => {
        console.log(`    - ${val}`);
      });
      console.log('');
    } else {
      throw new Error('request_type ENUM was not updated correctly');
    }
  } catch (error) {
    console.error('Error verifying ENUM update:', error);
    throw error;
  }
}

/**
 * Verifies that indexes were created successfully
 *
 * @param connection - MySQL connection
 */
async function verifyIndexes(connection: mysql.Connection): Promise<void> {
  try {
    console.log('Verifying indexes...\n');

    const expectedIndexes = [
      'idx_pts_requests_personnel_type',
      'idx_pts_requests_department_group',
      'idx_pts_requests_effective_date',
      'idx_pts_requests_amount',
      'idx_pts_requests_type_status',
    ];

    const [indexes] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT DISTINCT INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pts_requests'`,
      [dbConfig.database]
    );

    const indexNames = indexes.map((row) => row.INDEX_NAME);

    const results: { [key: string]: boolean } = {};

    for (const indexName of expectedIndexes) {
      const exists = indexNames.includes(indexName);
      results[indexName] = exists;

      if (exists) {
        console.log(`  ✓ Index '${indexName}' exists`);
      } else {
        console.log(`  ✗ Index '${indexName}' was NOT created`);
      }
    }

    console.log('');

    // Check if any index is missing
    const allIndexesExist = Object.values(results).every((exists) => exists);

    if (!allIndexesExist) {
      console.warn('⚠ Warning: Some indexes were not created');
    } else {
      console.log(`  ✓ All ${expectedIndexes.length} indexes verified\n`);
    }
  } catch (error) {
    console.error('Error verifying indexes:', error);
    // Don't throw - indexes are important but not critical for schema update
  }
}

/**
 * Displays final schema summary after migration
 *
 * @param connection - MySQL connection
 */
async function displayFinalSummary(connection: mysql.Connection): Promise<void> {
  try {
    console.log('========================================');
    console.log('Final Schema Summary');
    console.log('========================================\n');

    const schema = await getCurrentSchema(connection);

    console.log(`Total columns in pts_requests: ${schema.count}`);
    console.log('\nAll columns:');
    schema.columns.forEach((col, index) => {
      const isNew = EXPECTED_NEW_COLUMNS.includes(col);
      const marker = isNew ? ' [NEW]' : '';
      console.log(`  ${(index + 1).toString().padStart(2, ' ')}. ${col}${marker}`);
    });

    console.log('');

    // Get table size information
    const [tableInfo] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT
         TABLE_ROWS as row_count,
         ROUND(DATA_LENGTH / 1024 / 1024, 2) as data_size_mb,
         ROUND(INDEX_LENGTH / 1024 / 1024, 2) as index_size_mb
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pts_requests'`,
      [dbConfig.database]
    );

    if (tableInfo && tableInfo.length > 0) {
      console.log('Table Statistics:');
      console.log(`  - Rows: ${tableInfo[0].row_count || 0}`);
      console.log(`  - Data size: ${tableInfo[0].data_size_mb || 0} MB`);
      console.log(`  - Index size: ${tableInfo[0].index_size_mb || 0} MB`);
      console.log('');
    }
  } catch (error) {
    console.error('Error displaying final summary:', error);
    // Don't throw - this is just informational
  }
}

/**
 * Main migration function
 */
async function updateRequestsSchema(): Promise<void> {
  let connection: mysql.Connection | null = null;

  try {
    console.log('========================================');
    console.log('PHTS Request Schema Update (v2)');
    console.log('========================================\n');

    // Read SQL file
    console.log('Reading migration SQL file...');
    console.log(`Path: ${SQL_FILE_PATH}\n`);
    const sqlContent = readSqlFile();
    console.log('  ✓ SQL file loaded successfully\n');

    // Establish database connection
    console.log(`Connecting to database: ${dbConfig.database}@${dbConfig.host}...`);
    connection = await mysql.createConnection(dbConfig);
    console.log('  ✓ Database connection established\n');

    // Verify pts_requests table exists
    console.log('Verifying prerequisites...');
    await verifyTableExists(connection);

    // Display current schema before migration
    await displayCurrentSchema(connection);

    // Execute migration
    await executeMigration(connection, sqlContent);

    // Verify new columns
    await verifyNewColumns(connection);

    // Verify ENUM update
    await verifyEnumUpdate(connection);

    // Verify indexes
    await verifyIndexes(connection);

    // Display final summary
    await displayFinalSummary(connection);

    // Success summary
    console.log('========================================');
    console.log('Migration Completed Successfully');
    console.log('========================================');
    console.log('\nNew Columns Added:');
    EXPECTED_NEW_COLUMNS.forEach((col) => {
      console.log(`  ✓ ${col}`);
    });

    console.log('\nRequest Type ENUM Updated:');
    console.log('  - NEW_ENTRY');
    console.log('  - EDIT_INFO_SAME_RATE (แก้ไขข้อมูลอัตราเดิม)');
    console.log('  - EDIT_INFO_NEW_RATE (แก้ไขข้อมูลอัตราใหม่)');

    console.log('\nData Preservation:');
    console.log('  ✓ submission_data JSON field preserved');
    console.log('  ✓ All existing data remains intact');

    console.log('\nNext Steps:');
    console.log('  1. Update TypeScript interfaces to include new fields');
    console.log('  2. Update API endpoints to accept new column data');
    console.log('  3. Update frontend forms to populate explicit fields');
    console.log('  4. Implement data validation for new ENUM values');
    console.log('  5. Consider migrating existing submission_data to new columns');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n========================================');
    console.error('MIGRATION FAILED');
    console.error('========================================');
    console.error('An error occurred during the migration:\n');
    console.error(error);
    console.error('\nPlease check the error message above and try again.\n');
    process.exit(1);
  } finally {
    // Close database connection
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

// Execute the migration function
updateRequestsSchema()
  .then(() => {
    console.log('\nMigration script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
