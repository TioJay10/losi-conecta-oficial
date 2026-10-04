type CollaboratorSession = { version: 1; losiId: string; calendarToken: string };
const key = "losi-collaborator-session-v1";

export function readCollaboratorSession(): CollaboratorSession | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "null");
    return value?.version === 1 && /^LOSI-\d{6}$/.test(value.losiId) &&
      /^[0-9a-f-]{36}$/i.test(value.calendarToken) ? value : null;
  } catch { return null; }
}

export function rememberCollaborator(losiId: string, calendarToken: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ version: 1, losiId, calendarToken }));
  } catch { /* O link pessoal continua funcionando sem armazenamento local. */ }
}
