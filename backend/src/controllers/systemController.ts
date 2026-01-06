import { Request, Response } from 'express';
import { SyncService } from '../services/syncService.js';

export const syncSystemData = async (_req: Request, res: Response) => {
  try {
    const result = await SyncService.performFullSync();

    res.status(200).json({
      message: 'System synchronization completed successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    res.status(500).json({
      message: 'Failed to synchronize system data',
      error: error.message,
    });
  }
};

export const getSyncStatus = async (_req: Request, res: Response) => {
  try {
    const status = await SyncService.getLastSyncStatus();
    res.status(200).json({
      message: 'Sync status fetched successfully',
      data: status,
    });
  } catch (error: any) {
    console.error('Sync status error:', error);
    res.status(500).json({
      message: 'Failed to fetch sync status',
      error: error.message,
    });
  }
};
