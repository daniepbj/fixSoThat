import { useState, useCallback, useEffect } from 'react';

/**
 * Drop-in replacement for useState that also persists to localStorage.
 * Uses JSON serialisation – works with objects, arrays, primitives.
 * The returned setter is stable (same reference across renders), just like useState.
 */
export function useLocalStorage(key, initialValue, transform) {
  const applyTransform = useCallback((value) => {
    return transform ? transform(value) : value;
  }, [transform]);

  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item !== null ? JSON.parse(item) : initialValue;
      return applyTransform(parsed);
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      setStored((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(
          new CustomEvent('app-local-storage', {
            detail: { key, value: next },
          }),
        );
        return applyTransform(next);
      });
    } catch (e) {
      console.error('useLocalStorage write error:', e);
    }
  }, [key, applyTransform]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key !== key) return;
      try {
        const parsed =
          event.newValue !== null ? JSON.parse(event.newValue) : initialValue;
        setStored(applyTransform(parsed));
      } catch {
        setStored(initialValue);
      }
    }

    function handleLocalStorageEvent(event) {
      const detail = event.detail || {};
      if (detail.key !== key) return;
      setStored(applyTransform(detail.value));
    }

    window.addEventListener('storage', handleStorage);
    window.addEventListener('app-local-storage', handleLocalStorageEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app-local-storage', handleLocalStorageEvent);
    };
  }, [key, initialValue, applyTransform]);

  return [stored, setValue];
}
