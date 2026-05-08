const SOFIA_SESSION_KEY = 'sofia-session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export async function saveSofiaSession(user: any): Promise<void> {
  localStorage.setItem(SOFIA_SESSION_KEY, JSON.stringify({ user, timestamp: Date.now() }));
}

export function getSofiaStoredSession(): any | null {
  const stored = localStorage.getItem(SOFIA_SESSION_KEY);
  if (!stored) return null;

  try {
    const session = JSON.parse(stored);
    return Date.now() - session.timestamp < SESSION_TTL_MS ? session.user : null;
  } catch {
    return null;
  }
}
