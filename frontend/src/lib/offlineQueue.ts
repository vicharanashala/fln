import Dexie, { Table } from 'dexie';
import { apiFetch } from '../services/apiClient';

export type OfflineScanStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface OfflineScanRecord {
  id?: number;
  scanUuid: string;
  status: OfflineScanStatus;
  createdAt: string;
  imageBlob: Blob;
  metadata: Record<string, any>;
  error?: string;
}

class FLNOfflineDB extends Dexie {
  scans!: Table<OfflineScanRecord, number>;

  constructor() {
    super('FLNOfflineDB');
    this.version(1).stores({
      scans: '++id, scanUuid, status, createdAt',
    });
  }
}

export const offlineDb = new FLNOfflineDB();

export async function requestBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  const registration = await navigator.serviceWorker.ready as any;
  if (registration && typeof registration.sync?.register === 'function') {
    await registration.sync.register('sync-scans');
  }
}

function makeScanUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16 | 0;
    const value = char === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function saveScanOffline(data: { imageBlob: Blob; metadata: Record<string, any> }): Promise<OfflineScanRecord> {
  const record: OfflineScanRecord = {
    scanUuid: makeScanUuid(),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    imageBlob: data.imageBlob,
    metadata: data.metadata ?? {},
  };

  await offlineDb.scans.add(record);
  await requestBackgroundSync();
  return record;
}

export async function getPendingScans(): Promise<OfflineScanRecord[]> {
  return offlineDb.scans
    .where('status')
    .equals('PENDING')
    .sortBy('createdAt');
}

export async function markScanSynced(scanUuid: string): Promise<void> {
  await offlineDb.scans.where('scanUuid').equals(scanUuid).modify((scan) => {
    scan.status = 'SYNCED';
    scan.error = undefined;
  });
}

export async function markScanFailed(scanUuid: string, error: string): Promise<void> {
  await offlineDb.scans.where('scanUuid').equals(scanUuid).modify((scan) => {
    scan.status = 'FAILED';
    scan.error = error;
  });
}

export async function syncPendingScansNow(): Promise<{ processed: string[]; skippedDuplicates: string[]; error?: string }> {
  const pending = await getPendingScans();
  if (!pending.length) {
    return { processed: [], skippedDuplicates: [] };
  }

  const payload = {
    scans: await Promise.all(
      pending.map(async (scan) => ({
        scanUuid: scan.scanUuid,
        createdAt: scan.createdAt,
        metadata: scan.metadata ?? {},
        imageDataUrl: scan.imageBlob ? await blobToDataUrl(scan.imageBlob) : undefined,
      }))
    ),
  };

  const res = await apiFetch('/api/v1/scans/sync-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const message = await res.text();
    await Promise.all(
      pending.map((scan) => markScanFailed(scan.scanUuid, `Sync failed (${res.status}): ${message.slice(0, 200)}`))
    );
    return {
      processed: [],
      skippedDuplicates: [],
      error: message || `Sync failed (${res.status})`,
    };
  }

  const data = await res.json();
  const processed = Array.isArray(data?.processed) ? data.processed : [];
  const skippedDuplicates = Array.isArray(data?.skippedDuplicates) ? data.skippedDuplicates : [];

  await Promise.all(
    pending.map(async (scan) => {
      if (processed.includes(scan.scanUuid) || skippedDuplicates.includes(scan.scanUuid)) {
        await markScanSynced(scan.scanUuid);
      }
    })
  );

  return { processed, skippedDuplicates };
}
