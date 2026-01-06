import { Request, Response } from 'express';
import { PayrollService, PeriodStatus } from '../services/payrollService.js';
import { UserRole } from '../types/auth.js';

export const getPeriodStatus = async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      res.status(400).json({ message: 'Year and month are required' });
      return;
    }

    const period = await PayrollService.getOrCreatePeriod(
      Number(year),
      Number(month),
    );
    res.json(period);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const calculatePeriod = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const result = await PayrollService.processPeriodCalculation(
      Number(periodId),
    );
    res.json({ message: 'Calculation completed successfully', data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const submitToHR = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      'SUBMIT',
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveByHR = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      'APPROVE_HR',
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveByDirector = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      'APPROVE_DIRECTOR',
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const rejectPeriod = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;
    const actorId = (req.user as any)?.userId ?? (req.user as any)?.id;

    const result = await PayrollService.updatePeriodStatus(
      Number(periodId),
      'REJECT',
      actorId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
