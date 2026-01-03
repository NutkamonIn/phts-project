import { PoolConnection } from 'mysql2/promise';

function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

/**
 * Update employee eligibility in the same transaction as the request.
 */
export async function createEligibility(
  connection: PoolConnection,
  citizenId: string,
  masterRateId: number,
  effectiveDate: string | Date,
  requestId: number
): Promise<void> {
  const effectiveDateStr = toDateString(effectiveDate);

  await connection.execute(
    `UPDATE pts_employee_eligibility 
       SET is_active = 0, expiry_date = DATE_SUB(?, INTERVAL 1 DAY)
       WHERE citizen_id = ? AND is_active = 1 AND effective_date <= ?`,
    [effectiveDateStr, citizenId, effectiveDateStr]
  );

  await connection.execute(
    `INSERT INTO pts_employee_eligibility
       (citizen_id, master_rate_id, request_id, effective_date, is_active)
       VALUES (?, ?, ?, ?, 1)`,
    [citizenId, masterRateId, requestId, effectiveDateStr]
  );
}
