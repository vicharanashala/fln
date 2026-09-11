import express from 'express';
import { getAuthUser } from '../../auth';
import { dbStore } from '../../db';

const MAX_SCAN_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ScanSyncPayload {
  scanUuid?: string;
  createdAt?: string;
  metadata?: Record<string, any>;
  imageDataUrl?: string;
  [key: string]: any;
}

export function registerScanRoutes(app: express.Express) {
  app.post('/api/v1/scans/sync-batch', async (req, res) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rawScans = Array.isArray(req.body?.scans) ? req.body.scans : Array.isArray(req.body) ? req.body : [];

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

      const imageDataUrl = typeof payload.imageDataUrl === 'string' ? payload.imageDataUrl : undefined;
      if (imageDataUrl && Buffer.byteLength(imageDataUrl, 'utf8') > MAX_SCAN_IMAGE_BYTES) {
        return res.status(413).json({ error: 'Scan image exceeds the 5MB limit.' });
      }

      await dbStore.addScan({
        id: scanUuid,
        scanUuid,
        status: 'SYNCED',
        createdAt: payload.createdAt || new Date().toISOString(),
        metadata: payload.metadata ?? {},
        imageDataUrl,
        userId: user.id,
        schoolId: user.schoolId || undefined,
      });

      processed.push(scanUuid);
    }

    return res.status(200).json({ processed, skippedDuplicates });
  });
}
