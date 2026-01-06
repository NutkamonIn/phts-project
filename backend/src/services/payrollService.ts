import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import db from '../config/database.js';
import { payrollService as calculator } from './payroll/calculator.js';
import { calculateRetroactive } from './payroll/retroactive.js';

export enum PeriodStatus {
  OPEN = 'OPEN',
  WAITING_HR = 'WAITING_HR',
  WAITING_DIRECTOR = 'WAITING_DIRECTOR',
  CLOSED = 'CLOSED',
}

interface PeriodSummary {
  period_id: number;
  period_month: number;
  period_year: number;
  status: PeriodStatus;
  total_amount: number;
  total_headcount: number;
  created_at: Date;
}

export class PayrollService {
  /**
   * Initialize or fetch a period; creates new row with OPEN status if missing.
   */
  static async getOrCreatePeriod(year: number, month: number): Promise<PeriodSummary> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pts_periods WHERE period_month = ? AND period_year = ?',
      [month, year],
    );

    if (rows.length > 0) {
      return rows[0] as PeriodSummary;
    }

    const [res] = await db.execute<ResultSetHeader>(
      'INSERT INTO pts_periods (period_month, period_year, status) VALUES (?, ?, ?)',
      [month, year, PeriodStatus.OPEN],
    );

    const [newRows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pts_periods WHERE period_id = ?',
      [res.insertId],
    );
    return newRows[0] as PeriodSummary;
  }

  /**
   * Run payroll calculation for a period (re-run safe).
   */
  static async processPeriodCalculation(periodId: number) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [period] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM pts_periods WHERE period_id = ? FOR UPDATE',
        [periodId],
      );

      if (!period.length) throw new Error('Period not found');
      if (period[0].status !== PeriodStatus.OPEN) {
        throw new Error('ไม่สามารถคำนวณได้เนื่องจากงวดเดือนไม่ได้อยู่ในสถานะ OPEN');
      }

      const year = period[0].period_year;
      const month = period[0].period_month;

      await conn.execute('DELETE FROM pts_payouts WHERE period_id = ?', [periodId]);

      const [eligibleUsers] = await conn.query<RowDataPacket[]>(
        `
        SELECT DISTINCT citizen_id FROM pts_employee_eligibility 
        WHERE is_active = 1 
        AND effective_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
      `,
        [year, month],
      );

      let totalAmount = 0;
      let headCount = 0;

      for (const user of eligibleUsers) {
        const citizenId = user.citizen_id;

        const currentResult = await calculator.calculateMonthly(citizenId, year, month);
        const retroResult = await calculateRetroactive(citizenId, year, month);

        currentResult.retroactiveTotal = retroResult.totalRetro;
        currentResult.retroDetails = retroResult.retroDetails;

        const grandTotal = currentResult.netPayment + (currentResult.retroactiveTotal || 0);

        if (grandTotal > 0 || currentResult.netPayment > 0) {
          await calculator.savePayout(
            conn as PoolConnection,
            periodId,
            citizenId,
            currentResult,
            currentResult.masterRateId,
            currentResult.rateSnapshot,
            year,
            month,
          );

          totalAmount += grandTotal;
          headCount++;
        }
      }

      await conn.execute(
        'UPDATE pts_periods SET total_amount = ?, total_headcount = ?, created_at = NOW() WHERE period_id = ?',
        [totalAmount, headCount, periodId],
      );

      await conn.commit();
      return { success: true, headCount, totalAmount };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Transition period status through workflow.
   */
  static async updatePeriodStatus(
    periodId: number,
    action: 'SUBMIT' | 'APPROVE_HR' | 'APPROVE_DIRECTOR' | 'REJECT',
    _actorId: number,
  ) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM pts_periods WHERE period_id = ? FOR UPDATE',
        [periodId],
      );
      if (!rows.length) throw new Error('Period not found');

      const currentStatus = rows[0].status;
      let nextStatus: PeriodStatus | null = null;

      if (action === 'SUBMIT' && currentStatus === PeriodStatus.OPEN) {
        nextStatus = PeriodStatus.WAITING_HR;
      } else if (action === 'APPROVE_HR' && currentStatus === PeriodStatus.WAITING_HR) {
        nextStatus = PeriodStatus.WAITING_DIRECTOR;
      } else if (action === 'APPROVE_DIRECTOR' && currentStatus === PeriodStatus.WAITING_DIRECTOR) {
        nextStatus = PeriodStatus.CLOSED;
      } else if (action === 'REJECT') {
        nextStatus = PeriodStatus.OPEN;
      } else {
        throw new Error(`Invalid action '${action}' for status '${currentStatus}'`);
      }

      let sql = 'UPDATE pts_periods SET status = ?';
      const params: any[] = [nextStatus];

      if (nextStatus === PeriodStatus.CLOSED) {
        sql += ', closed_at = NOW()';
      }

      sql += ' WHERE period_id = ?';
      params.push(periodId);

      await conn.execute(sql, params);

      await conn.commit();
      return { success: true, status: nextStatus };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Fetch period summary by id.
   */
  static async getPeriodById(periodId: number) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pts_periods WHERE period_id = ?',
      [periodId],
    );
    return rows[0] || null;
  }
}
