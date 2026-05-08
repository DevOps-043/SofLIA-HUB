const LIA_CRED_KEY = 'lia-sync-cred';

export function storeLiaCredentials(email: string, password: string) {
  try {
    localStorage.setItem(LIA_CRED_KEY, JSON.stringify({ e: email, p: password }));
  } catch {
    // Local persistence is optional.
  }
}

export function retrieveLiaCredentials(): { email: string; password: string } | null {
  try {
    const raw = localStorage.getItem(LIA_CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.e && parsed?.p ? { email: parsed.e, password: parsed.p } : null;
  } catch {
    return null;
  }
}

export function clearLiaCredentials() {
  try {
    localStorage.removeItem(LIA_CRED_KEY);
  } catch {
    // Local persistence is optional.
  }
}
