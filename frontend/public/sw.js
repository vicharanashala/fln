// This service worker does not cache the app shell, static assets, or API
// responses. Its only responsibility is to observe the background-sync event
// for queued scans and trigger a single upload attempt when connectivity is restored.
const SYNC_TAG = 'sync-scans';

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FLNOfflineDB', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('scans')) {
        db.createObjectStore('scans', { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open FLNOfflineDB'));
  });
}

async function getPendingScans() {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('scans', 'readonly');
    const store = tx.objectStore('scans');
    const request = store.getAll();
    request.onsuccess = () => {
      const rows = Array.isArray(request.result) ? request.result : [];
      resolve(rows.filter((row) => row && row.status === 'PENDING'));
    };
    request.onerror = () => reject(request.error || new Error('Unable to read scans'));
  });
}

function markScanStatus(scanUuid, status, error) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FLNOfflineDB', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('scans', 'readwrite');
      const store = tx.objectStore('scans');
      const getRequest = store.getAll();
      getRequest.onsuccess = () => {
        const rows = getRequest.result || [];
        const match = rows.find((row) => row.scanUuid === scanUuid);
        if (!match) {
          resolve();
          return;
        }
        const update = { ...match, status, error: error || undefined };
        const updateRequest = store.put(update);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error || new Error('Failed to update status'));
      };
      getRequest.onerror = () => reject(getRequest.error || new Error('Unable to find scan'));
    };
    request.onerror = () => reject(request.error || new Error('Unable to open FLNOfflineDB'));
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    if (!blob) {
      resolve(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

async function syncPendingScans() {
  const pending = await getPendingScans();
  if (!pending.length) return;

  const scans = await Promise.all(
    pending.map(async (scan) => ({
      scanUuid: scan.scanUuid,
      createdAt: scan.createdAt,
      metadata: scan.metadata || {},
      imageDataUrl: await blobToDataUrl(scan.imageBlob),
    }))
  );

  const response = await fetch('/api/scans/sync-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scans }),
  });

  if (response.ok) {
    const result = await response.json().catch(() => ({}));
    const processed = Array.isArray(result.processed) ? result.processed : [];
    const skipped = Array.isArray(result.skippedDuplicates) ? result.skippedDuplicates : [];
    const syncedIds = new Set([...processed, ...skipped]);

    await Promise.all(
      pending.map(async (scan) => {
        if (syncedIds.has(scan.scanUuid)) {
          await markScanStatus(scan.scanUuid, 'SYNCED', undefined);
        }
      })
    );
    return;
  }

  const message = await response.text().catch(() => 'Sync failed');
  await Promise.all(
    pending.map((scan) => markScanStatus(scan.scanUuid, 'FAILED', message.slice(0, 200)))
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(self.clients.claim());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingScans());
  }
});
