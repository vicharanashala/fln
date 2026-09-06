import express from 'express';
import { dbStore } from '../../db';

export interface ScanSyncPayload {
  scanUuid?: string;
  createdAt?: string;
  metadata?: Record<string, any>;
  imageDataUrl?: string;
  [key: string]: any;
}

export function registerScanRoutes(app: express.Express) {
  app.post('/api/v1/scans/sync-batch', async (req, res) => {
    const rawScans = Array.isArray(req.body?.scans) ? req.body.scans : Array.isArray(req.body) ? req.body : [];

    if (!Array.isArray(rawScans)) {
      return res.status(400).json({ error: 'Expected array of scan records.' });
    }

    const processed: string[] = [];
    const skippedDuplicates: string[] = [];

    for (const entry of rawScans) {
      const payload = (entry ?? {}) as ScanSyncPayload;
      const scanUuid = typeof payload.scanUuid === 'string' ? payload.scanUuid : null;

      if (!scanUuid) {
        continue;
      }

      const existing = await dbStore.getScanByUuid(scanUuid);
      if (existing) {
        skippedDuplicates.push(scanUuid);
        continue;
      }

      await dbStore.addScan({
        id: scanUuid,
        scanUuid,
        status: 'SYNCED',
        createdAt: payload.createdAt || new Date().toISOString(),
        metadata: payload.metadata ?? {},
        imageDataUrl: typeof payload.imageDataUrl === 'string' ? payload.imageDataUrl : undefined,
      });

      processed.push(scanUuid);
    }

    return res.status(200).json({ processed, skippedDuplicates });
  });
}
