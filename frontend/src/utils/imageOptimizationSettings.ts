const STORAGE_KEY = 'fln.imageOptimization.enabled';
const DEFAULT_ENABLED = true;
const listeners = new Set<(enabled: boolean) => void>();

function readRaw(): boolean | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    return raw === 'true';
  } catch {
    return null;
  }
}

function writeRaw(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore quota / disabled storage
  }
}

export function isImageOptimizationEnabled(): boolean {
  const value = readRaw();
  return value === null ? DEFAULT_ENABLED : value;
}

export function setImageOptimizationEnabled(enabled: boolean): void {
  writeRaw(enabled);
  listeners.forEach((listener) => listener(enabled));
}

export function subscribeImageOptimization(
  listener: (enabled: boolean) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const IMAGE_OPTIMIZATION_DEFAULTS = {
  enabled: DEFAULT_ENABLED,
  storageKey: STORAGE_KEY,
} as const;