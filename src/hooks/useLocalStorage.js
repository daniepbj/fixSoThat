import { useState } from 'react';

/**
 * Drop-in replacement for useState that also persists to localStorage.
 * Uses JSON serialisation – works with objects, arrays, primitives.
 */
export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const next = typeof value === 'function' ? value(stored) : value;
      setStored(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch (e) {
      console.error('useLocalStorage write error:', e);
    }
  };

  return [stored, setValue];
}
