import { useState, useEffect } from 'react';

/**
 * Hook do debounce'owania wartości
 * @param {any} value - wartość do debounce'owania
 * @param {number} delay - opóźnienie w ms (domyślnie 300ms)
 * @returns {any} - zdebounce'owana wartość
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
