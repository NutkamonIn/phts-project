import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Decimal } from 'decimal.js';
import pool from '../../config/database.js';
import { LIFETIME_LICENSE_KEYWORDS } from '../../config/payroll.constants.js';
import { calculateDeductions, LeaveRow, QuotaRow } from './deductions.js';
import { formatLocalDate, makeLocalDate } from './utils.js';

export interface EligibilityRow extends RowDataPacket {
  effective_date: Date | string;
  expiry_date: Date | string | null;
  rate: number;
}

export interface MovementRow extends RowDataPacket {
  effective_date: Date | string;
  movement_type: string;
}

export interface LicenseRow extends RowDataPacket {
  valid_from: Date | string;
  valid_until: Date | string;
  status: string;
  license_name?: string;
  license_type?: string;
  occupation_name?: string;
}

export interface HolidayRow extends RowDataPacket {
  holiday_date: Date | string;
}

export interface EmployeeRow extends RowDataPacket {
  position_name?: string | null;
}

export interface CalculationResult {
  netPayment: number;
  totalDeductionDays: number;
  validLicenseDays: number;
  eligibleDays: number;
  remark: string;
  masterRateId: number | null;
  rateSnapshot: number;
  retroactiveTotal?: number;
  retroDetails?: RetroDetail[];
}

export interface RetroDetail {
  month: number;
  year: number;
  diff: number;
  remark: string;
}

interface WorkPeriod {
  start: Date;
  end: Date;
}

export async function calculateMonthly(
  citizenId: string,
  year: number,
  month: number,
): Promise<CalculationResult> {
  const startOfMonth = makeLocalDate(year, month - 1, 1);
  const endOfMonth = makeLocalDate(year, month, 0);
  const daysInMonth = endOfMonth.getDate();
  const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

  const [
    [eligibilityRows],
    [movementRows],
    [employeeRows],
    [licenseRows],
    [leaveRows],
    [quotaRows],
    [holidayRows],
  ] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `
        SELECT e.effective_date, e.expiry_date, m.amount as rate, m.rate_id
        FROM pts_employee_eligibility e
        JOIN pts_master_rates m ON e.master_rate_id = m.rate_id
        WHERE e.citizen_id = ? AND e.is_active = 1
        AND e.effective_date <= ? 
        AND (e.expiry_date IS NULL OR e.expiry_date >= ?)
        ORDER BY e.effective_date ASC
      `,
      [citizenId, endOfMonth, startOfMonth],
    ),
    pool.query<RowDataPacket[]>(
      `
        SELECT * FROM pts_employee_movements 
        WHERE citizen_id = ? AND effective_date <= ?
        ORDER BY effective_date ASC, created_at ASC
      `,
      [citizenId, endOfMonth],
    ),
    pool.query<RowDataPacket[]>(`SELECT position_name FROM pts_employees WHERE citizen_id = ? LIMIT 1`, [
      citizenId,
    ]),
    pool.query<RowDataPacket[]>(`SELECT * FROM pts_employee_licenses WHERE citizen_id = ?`, [
      citizenId,
    ]),
    pool.query<RowDataPacket[]>(
      `
        SELECT * FROM pts_leave_requests 
        WHERE citizen_id = ? AND fiscal_year = ?
        ORDER BY start_date ASC
      `,
      [citizenId, fiscalYear],
    ),
    pool.query<RowDataPacket[]>(`SELECT * FROM pts_leave_quotas WHERE citizen_id = ? AND fiscal_year = ?`, [
      citizenId,
      fiscalYear,
    ]),
    // Holidays: cover previous year as well to include fiscal-year crossings (Oct-Dec of prior year)
    pool.query<RowDataPacket[]>(`SELECT holiday_date FROM pts_holidays WHERE holiday_date BETWEEN ? AND ?`, [
      `${year - 1}-01-01`,
      `${year}-12-31`,
    ]),
  ]);

  const eligibilities = eligibilityRows as EligibilityRow[];
  const movements = movementRows as MovementRow[];
  const employee = (employeeRows as EmployeeRow[])[0] || {};
  const licenses = licenseRows as LicenseRow[];
  const leaves = leaveRows as LeaveRow[];
  const quota = ((quotaRows as QuotaRow[])[0] as QuotaRow | undefined) || ({} as QuotaRow);
  const holidays = (holidayRows as HolidayRow[]).map((h) => formatLocalDate(h.holiday_date));

  const { periods, remark } = resolveWorkPeriods(movements, startOfMonth, endOfMonth);
  if (periods.length === 0) {
    return emptyResult(remark || 'ไม่ได้ปฏิบัติงานในเดือนนี้');
  }

  const deductionMap = calculateDeductions(leaves, quota, holidays, startOfMonth, endOfMonth);

  let totalPayment = new Decimal(0);
  let validLicenseDays = 0;
  let totalDeductionDays = 0;
  let daysCounted = 0;
  let lastRateSnapshot = 0;
  let lastMasterRateId: number | null = null;

  for (const period of periods) {
    for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);

      const activeElig = eligibilities.find((e) => {
        const eff = new Date(e.effective_date);
        const exp = e.expiry_date ? new Date(e.expiry_date) : makeLocalDate(9999, 11, 31);
        return d >= eff && d <= exp;
      });
      const currentRate = activeElig ? Number(activeElig.rate) : 0;
      if (activeElig) {
        lastRateSnapshot = currentRate;
        lastMasterRateId = (activeElig as any).rate_id ?? null;
      }

      const hasLicense = checkLicense(licenses, dateStr, employee.position_name || '');
      if (hasLicense) validLicenseDays++;

      const deductionWeight = deductionMap.get(dateStr) || 0;

      let eligibleWeight = hasLicense ? 1 : 0;
      eligibleWeight -= deductionWeight;
      if (eligibleWeight < 0) eligibleWeight = 0;

      if (deductionWeight > 0) totalDeductionDays += deductionWeight;
      if (eligibleWeight > 0) daysCounted += eligibleWeight;

      const dailyRate = new Decimal(currentRate || 0).div(daysInMonth);
      totalPayment = totalPayment.plus(dailyRate.mul(eligibleWeight));
    }
  }

  return {
    netPayment: totalPayment
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber(),
    totalDeductionDays,
    validLicenseDays,
    eligibleDays: daysCounted,
    remark,
    masterRateId: lastMasterRateId,
    rateSnapshot: lastRateSnapshot,
  };
}

export function checkLicense(licenses: LicenseRow[], dateStr: string, positionName = ''): boolean {
  const keywordList = LIFETIME_LICENSE_KEYWORDS.map((kw) =>
    kw.trim().toLowerCase().normalize('NFC'),
  ).filter(Boolean);

  const normalizedPosition = positionName.toLowerCase().normalize('NFC');
  if (normalizedPosition && keywordList.some((kw) => normalizedPosition.includes(kw))) {
    return true;
  }

  return licenses.some((lic) => {
    if (keywordList.length > 0) {
      const combined = `${lic.license_name ?? ''} ${lic.license_type ?? ''} ${lic.occupation_name ?? ''}`
        .toLowerCase()
        .normalize('NFC');
      if (keywordList.some((kw) => combined.includes(kw))) return true;
    }

    const start = formatLocalDate(lic.valid_from);
    const end = formatLocalDate(lic.valid_until);
    const statusOk = (lic.status || '').toUpperCase() === 'ACTIVE';
    const withinRange = dateStr >= start && dateStr <= end;

    return statusOk && withinRange;
  });
}

export async function savePayout(
  conn: PoolConnection,
  periodId: number,
  citizenId: string,
  result: CalculationResult,
  masterRateId: number | null,
  baseRateSnapshot: number,
  referenceYear: number,
  referenceMonth: number,
): Promise<number> {
  const totalPayable = result.netPayment + (result.retroactiveTotal ?? 0);

  const [res] = await conn.query<ResultSetHeader>(
    `
      INSERT INTO pts_payouts 
      (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable, deducted_days, eligible_days, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      periodId,
      citizenId,
      masterRateId,
      baseRateSnapshot,
      result.netPayment,
      totalPayable,
      result.totalDeductionDays,
      result.eligibleDays,
      result.remark,
    ],
  );

  const payoutId = res.insertId;

  if (result.netPayment !== 0) {
    await conn.query(
      `
        INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount, description)
        VALUES (?, ?, ?, 'CURRENT', ?, 'ค่าตอบแทนงวดปัจจุบัน')
      `,
      [payoutId, referenceMonth, referenceYear, result.netPayment],
    );
  }

  if (result.retroDetails && result.retroDetails.length > 0) {
    for (const detail of result.retroDetails) {
      const itemType = detail.diff > 0 ? 'RETROACTIVE_ADD' : 'RETROACTIVE_DEDUCT';
      await conn.query(
        `
          INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [payoutId, detail.month, detail.year, itemType, Math.abs(detail.diff), detail.remark],
      );
    }
  } else if (result.retroactiveTotal && Math.abs(result.retroactiveTotal) > 0.01) {
    const itemType = result.retroactiveTotal > 0 ? 'RETROACTIVE_ADD' : 'RETROACTIVE_DEDUCT';
    await conn.query(
      `
        INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        0,
        0,
        itemType,
        Math.abs(result.retroactiveTotal),
        'ปรับตกเบิกย้อนหลัง (รวมยอด)',
      ],
    );
  }

  return payoutId;
}

function resolveWorkPeriods(
  movements: MovementRow[],
  monthStart: Date,
  monthEnd: Date,
): { periods: WorkPeriod[]; remark: string } {
  const relevant = movements.filter((m) => new Date(m.effective_date) <= monthEnd);
  if (relevant.length === 0) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: '' };
  }
  // trust DB ordering (effective_date, created_at) to keep stable swaps in same day

  let remark = '';
  let active = false;

  for (const mov of relevant) {
    const date = new Date(mov.effective_date);
    if (date < monthStart) {
      if (mov.movement_type === 'ENTRY') active = true;
      else if (mov.movement_type === 'STUDY') {
        active = false;
        remark = 'ลาศึกษาต่อ';
      } else if (['RESIGN', 'RETIRE', 'DEATH', 'TRANSFER_OUT'].includes(mov.movement_type)) {
        active = false;
      }
    }
  }

  const periods: WorkPeriod[] = [];
  let currentStart: Date | null = active ? new Date(monthStart) : null;

  for (const mov of relevant) {
    const date = new Date(mov.effective_date);
    if (date < monthStart || date > monthEnd) continue;

    if (mov.movement_type === 'STUDY') {
      active = false;
      currentStart = null;
      remark = 'ลาศึกษาต่อ';
      break;
    }

    if (mov.movement_type === 'ENTRY') {
      if (!active) {
        active = true;
        currentStart = date < monthStart ? new Date(monthStart) : date;
      }
    } else if (['RESIGN', 'RETIRE', 'DEATH', 'TRANSFER_OUT'].includes(mov.movement_type)) {
      if (active && currentStart) {
        const end = makeLocalDate(date.getFullYear(), date.getMonth(), date.getDate() - 1);
        if (end >= monthStart) {
          periods.push({ start: currentStart, end: end > monthEnd ? monthEnd : end });
        }
      }
      active = false;
      currentStart = null;
    }
  }

  if (active && currentStart) {
    periods.push({ start: currentStart, end: monthEnd });
  }

  return { periods, remark };
}

function emptyResult(remark: string): CalculationResult {
  return {
    netPayment: 0,
    totalDeductionDays: 0,
    validLicenseDays: 0,
    eligibleDays: 0,
    remark,
    masterRateId: null,
    rateSnapshot: 0,
  };
}

export const payrollService = {
  calculateMonthly,
  calculateDeductions,
  checkLicense,
  savePayout,
};
