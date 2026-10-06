type CollaboratorSession = { version: 2; losiId: string; sessionToken: string };
export const collaboratorSessionKey = "losi-collaborator-session-v2";
export function readCollaboratorSession(): CollaboratorSession | null {
 if (typeof window === "undefined") return null;
 try {
  window.localStorage.removeItem("losi-collaborator-session-v1");
  const value = JSON.parse(window.localStorage.getItem(collaboratorSessionKey) || "null");
  return value?.version === 2 && /^LOSI-\d{6}$/.test(value.losiId) && /^[0-9a-f]{64}$/.test(value.sessionToken) ? value : null;
 } catch { return null; }
}
export function rememberCollaborator(losiId: string, sessionToken: string): boolean {
 if (typeof window === "undefined" || !/^LOSI-\d{6}$/.test(losiId) || !/^[0-9a-f]{64}$/.test(sessionToken)) return false;
 try { window.localStorage.setItem(collaboratorSessionKey, JSON.stringify({version: 2, losiId, sessionToken})); return true; }
 catch { return false; }
}
export function clearCollaboratorSession() {
 if (typeof window === "undefined") return;
 try { window.localStorage.removeItem(collaboratorSessionKey); window.localStorage.removeItem("losi-collaborator-session-v1"); } catch { /* The server revokes the device credential on logout. */ }
}
