import { useEffect, useState } from 'react';

export type LosiChatTheme = 'dark' | 'light';
export const LOSI_CHAT_THEME_KEY = 'losi-chat-theme-v1';

export function readChatTheme(): LosiChatTheme {
  try { return window.localStorage.getItem(LOSI_CHAT_THEME_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

/** Device preference only; theme changes never alter the account or conversation. */
export function useLosiChatTheme() {
  // Keep server rendering and the first hydration render identical.
  const [theme, setTheme] = useState<LosiChatTheme>('dark');
  useEffect(() => {
    setTheme(readChatTheme());
    const sync = (event: StorageEvent) => {
      if (event.key === LOSI_CHAT_THEME_KEY || event.key === null) setTheme(readChatTheme());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { window.localStorage.setItem(LOSI_CHAT_THEME_KEY, next); }
    catch { /* The switch still works when browser storage is disabled. */ }
  }
  return { theme, toggleTheme };
}
