import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only settles once `delay` ms have
 * passed without another change. Useful for keeping search boxes from firing a
 * request on every keystroke.
 */
export const useDebounce = <T,>(value: T, delay = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
