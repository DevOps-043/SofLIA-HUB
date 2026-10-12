import fs from 'node:fs';
import path from 'node:path';
import type { Session } from 'electron';
import { ECOSYSTEM_APPS, ecosystemOrigin } from '../../src/shared/browser-ecosystem';
import { getSofiaClient } from '../iris/clients';
import { getAuthState, onAuthStateChange } from '../main/auth-state';
import { getSofiaSessionUserId } from '../main/sofia-session';
import { readLearningBaseUrl } from '../learning-sso';
import { connectEcosystemSession } from './ecosystem-session';
import { browserProfilePath, browserScopeIdFor, getBrowserProfileKind, getBrowserScopeId } from './profile-scope';

export function ecosystemSessionOrigins(): string[] {
  const origins = ECOSYSTEM_APPS.map(app => new URL(app.url).origin);
  origins.push('https://www.soflia.ai', 'https://irisia.netlify.app');
  const configured = readLearningBaseUrl();
  if (configured) {
    try {
      const url = new URL(configured);
      if (!url.username && !url.password && url.pathname === '/' && !url.search && !url.hash &&
          (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) origins.push(url.origin);
    } catch { /* Un origen inválido no recibe identidad. */ }
  }
  return origins;
}

const flights = new Map<string, Promise<boolean>>();
const retryAfter = new Map<string, number>();
const signOutRevision = new Map<string, number>();
const signOutSuppressed = new Set<string>();

function relatedOrigins(origin: string): string[] {
  const origins = ecosystemSessionOrigins();
  if (['https://sofliahub.netlify.app', 'https://irisia.netlify.app'].includes(origin)) return ['https://sofliahub.netlify.app', 'https://irisia.netlify.app'];
  if (origin === 'https://soflia-coursegen.netlify.app') return [origin];
  return origins.filter(value => !['https://sofliahub.netlify.app', 'https://irisia.netlify.app', 'https://soflia-coursegen.netlify.app'].includes(value));
}

/** Un cierre explícito se conserva por sitio y usuario hasta la reconexión manual. */
export function rememberEcosystemSignOut(target: string): void {
  const origin = ecosystemOrigin(target, ecosystemSessionOrigins());
  if (!origin || getBrowserProfileKind() !== 'authenticated') return;
  const aliases = relatedOrigins(origin);
  for (const site of aliases) {
    const key = `${getBrowserScopeId()}:${site}`;
    signOutRevision.set(key, (signOutRevision.get(key) || 0) + 1);
    signOutSuppressed.add(key);
  }
  const file = browserProfilePath('ecosystem-session.json');
  const state = readState(file);
  writeState(file, { ...state, signedOut: [...new Set([...state.signedOut, ...aliases])] });
}

export function responseClearsEcosystemSession(headers: Record<string, string[]>): boolean {
  const values = Object.entries(headers).filter(([key]) => key.toLowerCase() === 'set-cookie').flatMap(([, cookies]) => cookies);
  const sessions = values.map(value => /^\s*(cf_access_token|accessToken|sb-[a-z0-9]+-auth-token(?:\.\d+)?)=([^;]*)/i.exec(value)).filter(match => match !== null);
  return sessions.some(match => !match[2] && !sessions.some(other => other[2] && other[1].replace(/\.\d+$/, '') === match[1].replace(/\.\d+$/, '')));
}

export function responseIndicatesEcosystemSignOut(method: string, status: number, headers: Record<string, string[]>): boolean {
  return method === 'POST' && status >= 200 && status < 400 && responseClearsEcosystemSession(headers);
}

export function prepareEcosystemSession(target: string, session: Session, assertCurrent: () => void, replace = false): Promise<boolean> {
  const auth = getAuthState();
  const scope = getBrowserScopeId();
  const origin = ecosystemOrigin(target, ecosystemSessionOrigins());
  if (!origin || !auth.authenticated || !auth.userId || getBrowserProfileKind() !== 'authenticated' || scope !== browserScopeIdFor(auth.userId)) return Promise.resolve(false);
  const file = browserProfilePath('ecosystem-session.json');
  const key = `${scope}:${origin}`;
  const revision = signOutRevision.get(key) || 0;
  const pending = flights.get(key);
  if (pending) return pending.catch(() => false).then(() => prepareEcosystemSession(target, session, assertCurrent, replace));
  if (!replace && (retryAfter.get(key) || 0) > Date.now()) return Promise.resolve(false);
  const controller = new AbortController();
  const unsubscribe = onAuthStateChange(() => controller.abort());
  const guard = () => {
    assertCurrent();
    if ((signOutRevision.get(key) || 0) !== revision) throw new Error('Se cerró la sesión del sitio durante la conexión.');
    if (controller.signal.aborted || getBrowserScopeId() !== scope || getBrowserProfileKind() !== 'authenticated' || getAuthState().userId !== auth.userId) throw new Error('La sesión del navegador cambió.');
  };
  const operation = (async () => {
    guard();
    // La web valida sus cookies y preserva una cuenta vigente. Una cookie
    // obsoleta por sí sola no demuestra que ya exista una sesión utilizable.
    return connectEcosystemSession(target, {
      origins: [origin], assertCurrent: guard, signal: controller.signal,
      fetcher: (input, init) => session.fetch(input instanceof URL ? input.toString() : input, init),
      getIdentity: async () => {
        guard();
        const client = getSofiaClient();
        if (!client || getSofiaSessionUserId() !== auth.userId) return null;
        const { data, error } = await client.auth.getSession();
        guard();
        return !error && data.session?.user.id === auth.userId ? { userId: auth.userId!, accessToken: data.session.access_token } : null;
      },
      hasConnected: site => { const state = readState(file); return signOutSuppressed.has(key) || state.signedOut.includes(site) || state.connected.includes(site); },
      remember: site => {
        guard();
        const state = readState(file);
        const aliases = relatedOrigins(site);
        writeState(file, { connected: [...new Set([...state.connected, site])], signedOut: state.signedOut.filter(value => !aliases.includes(value)) });
        for (const alias of aliases) signOutSuppressed.delete(`${scope}:${alias}`);
      },
    }, replace);
  })().catch(error => { retryAfter.set(key, Date.now() + 60000); throw error; })
    .finally(() => { unsubscribe(); flights.delete(key); });
  flights.set(key, operation);
  return operation;
}

interface ConnectionState { version?: 2; connected: string[]; signedOut: string[] }
function readState(file: string): ConnectionState {
  if (!fs.existsSync(file)) return { connected: [], signedOut: [] };
  const text = fs.readFileSync(file, 'utf8');
  if (text.length > 16384) throw new Error('El registro de conexión no es válido.');
  const data = JSON.parse(text) as ConnectionState;
  if (!data || ![data.connected, data.signedOut].every(sites => Array.isArray(sites) && sites.length <= 32 && sites.every(site => typeof site === 'string'))) throw new Error('El registro de conexión no es válido.');
  // La versión inicial también marcaba conexiones por una cookie sin validarla.
  // Volver a comprobarlas en la web; conservar los cierres elegidos.
  return data.version === 2 ? data : { version: 2, connected: [], signedOut: data.signedOut };
}

function writeState(file: string, state: ConnectionState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify({ ...state, version: 2 }), { mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
}
