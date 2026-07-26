import { useEffect, useState } from 'react';

// Backs a piece of state with localStorage so in-progress input (not yet
// submitted/saved) survives an accidental refresh. Cheap to write on every
// keystroke since values here are short strings.
export function usePersistedState(key: string, initialValue: string): [string, (value: string) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      // localStorage may be unavailable (e.g. private browsing) — input just won't survive a refresh.
    }
  }, [key, value]);

  return [value, setValue];
}
