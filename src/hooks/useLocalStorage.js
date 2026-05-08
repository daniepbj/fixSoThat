import { useState, useCallback, useEffect } from 'react';

/**
 * Drop-in replacement for useState that also persists to localStorage.
 * Uses JSON serialisation – works with objects, arrays, primitives.
 * The returned setter is stable (same reference across renders), just like useState.
 */
export function useLocalStorage(key, initialValue, transform) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item !== null ? JSON.parse(item) : null;
      const value = (parsed !== null && parsed !== undefined) ? parsed : initialValue;
      return transform ? transform(value) : value;
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

  useEffect(() => {
    function handleStorage(e) {
      if (e.key !== null && e.key !== key) return;
      if (e.key === null) {
        // localStorage.clear() was called — reset this key to initialValue
        setStored(transform ? transform(initialValue) : initialValue);
        return;
      }
      try {
        const parsed = e.newValue !== null ? JSON.parse(e.newValue) : null;
        const value = (parsed !== null && parsed !== undefined) ? parsed : initialValue;
        setStored(transform ? transform(value) : value);
      } catch {
        // ignore malformed values from other tabs
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [key]);

  return [stored, setValue];
}

export default useLocalStorage;
