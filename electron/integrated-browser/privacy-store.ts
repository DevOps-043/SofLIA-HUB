import { flushPolicyFile, preparePolicyRecovery, readPolicyFile, serializePolicyFile, writePolicyFile, type PolicyRecoveryReview } from './policy-file-recovery';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserPrivacyCategory, BrowserPrivacyLevel, BrowserPrivacySiteState } from './platform-types';

type PrivacyFile = { version: 1; sites: BrowserPrivacySiteState[] };
type ProfileCache = { sites: Map<string, BrowserPrivacySiteState>; loaded: Promise<void>; queue: Promise<void> };
const LEVELS = new Set<BrowserPrivacyLevel>(['off', 'balanced', 'strict']);
const CATEGORIES = new Set<BrowserPrivacyCategory>(['tracker', 'advertising', 'third-party-cookie', 'tracking-parameter', 'fingerprinting', 'malware']);

export class BrowserPrivacyStore {
  private profiles = new Map<string, ProfileCache>();

  constructor(private readonly location: string | (() => string) = () => browserProfilePath('privacy.json')) {}

  async flush(): Promise<void> {
    const destination = resolveStoreLocation(this.location);
    const profile = this.profiles.get(destination);
    await profile?.loaded.catch(() => undefined);
    await profile?.queue;
    await flushPolicyFile(destination);
  }

  invalidateCache(): void {
    this.profiles.delete(resolveStoreLocation(this.location));
  }

  async get(rawOrigin: string): Promise<BrowserPrivacySiteState> {
    const profile = this.profile(resolveStoreLocation(this.location));
    await profile.loaded;
    await profile.queue;
    const origin = normalizePrivacyOrigin(rawOrigin);
    return cloneState(profile.sites.get(origin) ?? defaultState(origin));
  }

  peek(rawOrigin: string): BrowserPrivacySiteState {
    const origin = normalizePrivacyOrigin(rawOrigin);
    const profile = this.profiles.get(resolveStoreLocation(this.location));
    return cloneState(profile?.sites.get(origin) ?? defaultState(origin));
  }

  async set(raw: unknown): Promise<BrowserPrivacySiteState> {
    const input = validatePrivacyInput(raw);
    const destination = resolveStoreLocation(this.location);
    const profile = this.profile(destination);
    let saved!: BrowserPrivacySiteState;
    const pending = profile.queue.then(() => serializePolicyFile(destination, async () => {
      await profile.loaded;
      const fresh = await readPolicyFile<PrivacyFile>(destination, validatePrivacyFile, () => ({ version: 1, sites: [] }));
      const snapshot = new Map(fresh.sites.map(state => [state.origin, state]));
      const current = profile.sites.get(input.origin) ?? defaultState(input.origin);
      saved = { ...current, ...input, degraded: false };
      snapshot.set(saved.origin, saved);
      if (snapshot.size > 5_000) throw new Error('Se alcanzó la cuota de sitios de privacidad.');
      await this.persist(destination, snapshot);
      profile.sites = snapshot;
    }));
    profile.queue = pending.catch(() => undefined);
    await pending;
    return cloneState(saved);
  }

  async increment(rawOrigin: string, category: BrowserPrivacyCategory): Promise<void> {
    if (!CATEGORIES.has(category)) return;
    const profile = this.profile(resolveStoreLocation(this.location));
    await profile.loaded;
    await profile.queue;
    const origin = normalizePrivacyOrigin(rawOrigin);
    if (!profile.sites.has(origin) && profile.sites.size >= 5_000) return;
    const current = profile.sites.get(origin) ?? defaultState(origin);
    current.blocked = { ...current.blocked, [category]: Math.min(1_000_000, (current.blocked[category] ?? 0) + 1) };
    // Métricas de sesión en memoria: no escribir un archivo por solicitud de red.
    profile.sites.set(origin, current);
  }

  async hydrate(): Promise<void> {
    await this.profile(resolveStoreLocation(this.location)).loaded;
  }

  async prepareRecovery(guard: () => void): Promise<PolicyRecoveryReview> {
    const destination = resolveStoreLocation(this.location); await this.flush(); guard();
    let restored!: PrivacyFile;
    const review = await preparePolicyRecovery<PrivacyFile>(destination, validatePrivacyFile, file => {
      restored = validatePrivacyFile({ version: 1, sites: file.sites.map(site => ({ ...site, level: 'strict', exceptionCategories: [], blocked: {}, degraded: false })) });
      return { count: restored.sites.length, value: restored };
    }, guard);
    return { count: review.count, commit: async () => {
      await review.commit();
      // Publicar la proyección validada sin pasar por valores por omisión mientras se relee disco.
      // Conservar el objeto y su cola: otras mutaciones pueden haberse encolado durante el commit.
      const profile = this.profiles.get(destination) ?? { sites: new Map(), loaded: Promise.resolve(), queue: Promise.resolve() };
      profile.sites = new Map(restored.sites.map(site => [site.origin, cloneState(site)]));
      profile.loaded = Promise.resolve();
      this.profiles.set(destination, profile);
    } };
  }

  private profile(destination: string): ProfileCache {
    const existing = this.profiles.get(destination);
    if (existing) return existing;
    const profile: ProfileCache = { sites: new Map(), loaded: Promise.resolve(), queue: Promise.resolve() };
    this.profiles.set(destination, profile);
    profile.loaded = this.read(destination, profile);
    return profile;
  }

  private async read(destination: string, profile: ProfileCache): Promise<void> {
    try {
      const parsed = await readPolicyFile<PrivacyFile>(destination, validatePrivacyFile, () => ({ version: 1, sites: [] }));
      parsed.sites.forEach((state) => profile.sites.set(state.origin, state));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        const wrapped = new Error('La configuración de privacidad está dañada.');
        Object.defineProperty(wrapped, 'cause', { value: error });
        throw wrapped;
      }
    }
  }

  private async persist(destination: string, sites: Map<string, BrowserPrivacySiteState>): Promise<void> {
    await writePolicyFile(destination, { version: 1, sites: [...sites.values()].map(state => ({ ...state, blocked: {} })) }, validatePrivacyFile);
  }
}

function validatePrivacyFile(raw: unknown): PrivacyFile {
  const file = raw as PrivacyFile;
  if (!file || file.version !== 1 || !Array.isArray(file.sites) || file.sites.length > 5_000) throw new Error('Formato inválido.');
  return { version: 1, sites: file.sites.map(validateStoredState) };
}

export function normalizePrivacyOrigin(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('El origen de privacidad no está permitido.');
  return url.origin;
}

function defaultState(origin: string): BrowserPrivacySiteState {
  return { origin, level: 'balanced', blocked: {}, exceptionCategories: [], degraded: false };
}

function validatePrivacyInput(raw: unknown): Pick<BrowserPrivacySiteState, 'origin' | 'level' | 'exceptionCategories'> {
  if (!raw || typeof raw !== 'object') throw new Error('La configuración de privacidad es inválida.');
  const value = raw as { origin?: unknown; level?: unknown; exceptionCategories?: unknown };
  if (typeof value.origin !== 'string' || !LEVELS.has(value.level as BrowserPrivacyLevel) || !Array.isArray(value.exceptionCategories)
    || value.exceptionCategories.length > CATEGORIES.size || value.exceptionCategories.some((category) => !CATEGORIES.has(category as BrowserPrivacyCategory) || category === 'malware')) throw new Error('La configuración de privacidad es inválida.');
  return { origin: normalizePrivacyOrigin(value.origin), level: value.level as BrowserPrivacyLevel, exceptionCategories: [...new Set(value.exceptionCategories as BrowserPrivacyCategory[])] };
}

function validateStoredState(raw: BrowserPrivacySiteState): BrowserPrivacySiteState {
  const input = validatePrivacyInput(raw);
  if (!raw.blocked || typeof raw.blocked !== 'object' || typeof raw.degraded !== 'boolean') throw new Error('Estado inválido.');
  const blocked: BrowserPrivacySiteState['blocked'] = {};
  for (const [category, count] of Object.entries(raw.blocked)) {
    if (!CATEGORIES.has(category as BrowserPrivacyCategory) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Contador inválido.');
    blocked[category as BrowserPrivacyCategory] = count;
  }
  return { ...input, blocked, degraded: raw.degraded };
}

function cloneState(state: BrowserPrivacySiteState): BrowserPrivacySiteState {
  return { ...state, blocked: { ...state.blocked }, exceptionCategories: [...state.exceptionCategories] };
}
