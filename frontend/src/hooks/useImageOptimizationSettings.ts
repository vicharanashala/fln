import { useEffect, useState, useCallback } from 'react';
import {
  isImageOptimizationEnabled,
  setImageOptimizationEnabled,
  subscribeImageOptimization,
} from '../utils/imageOptimizationSettings';

export function useImageOptimizationSettings() {
  const [enabled, setEnabledState] = useState<boolean>(() => isImageOptimizationEnabled());

  useEffect(() => {
    return subscribeImageOptimization(setEnabledState);
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setImageOptimizationEnabled(next);
  }, []);

  return { enabled, setEnabled } as const;
}