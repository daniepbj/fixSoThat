import { useState, useCallback } from 'react';

/**
 * Drop-in replacement for useState that also persists to localStorage.
 * Uses JSON serialisation – works with objects, arrays, primitives.
 * The returned setter is stable (same reference across renders), just like useState.
 */
export function useLocalStorage(key, initialValue, transform) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item !== null ? JSON.parse(item) : initialValue;
      return transform ? transform(parsed) : parsed;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      setStored((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    } catch (e) {
      console.error('useLocalStorage write error:', e);
    }
  }, [key]);

  return [stored, setValue];
}
