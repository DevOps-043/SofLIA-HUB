import { dialog, systemPreferences, type BrowserWindow, type Session, type WebContents } from 'electron';
import { BrowserSitePermissionStore, normalizeOrigin } from './site-permissions';
import {
  BROWSER_SITE_PERMISSION_KINDS,
  BROWSER_SITE_PERMISSION_LABELS,
  type BrowserSitePermissionKind,
  type BrowserSitePermissionState,
  type BrowserSitePermissionSummary,
} from './types';

type ElectronCheckPermission = Parameters<NonNullable<Parameters<Session['setPermissionCheckHandler']>[0]>>[1];
type ElectronRequestPermission = Parameters<NonNullable<Parameters<Session['setPermissionRequestHandler']>[0]>>[1];

/**
 * Permisos que Chromium concede sin interrumpir al usuario y que el navegador
 * integrado no administra por sitio. Denegarlos rompia embebidos legitimos:
 * `storage-access` es lo que necesita el iframe de Meet dentro de Gmail para
 * leer su propia sesion, y `clipboard-sanitized-write` es el copiar de toda la
 * web.
 */
const AUTO_GRANTED_PERMISSIONS = new Set([
  'clipboard-sanitized-write',
  'storage-access',
  'top-level-storage-access',
]);

/**
 * Traduccion de los nombres de Electron a las categorias del panel. Lo que no
 * aparece aqui ni en la lista anterior se deniega: acceso a dispositivos
 * (`usb`, `serial`, `hid`, MIDI), apertura de aplicaciones externas y sistema
 * de archivos no tienen un caso de uso en este navegador.
 */
const PERMISSION_KIND_BY_NAME: Record<string, BrowserSitePermissionKind> = {
  geolocation: 'geolocation',
  notifications: 'notifications',
  'display-capture': 'display-capture',
  'clipboard-read': 'clipboard-read',
  'idle-detection': 'idle-detection',
  'window-management': 'window-management',
  fullscreen: 'fullscreen',
  pointerLock: 'pointer-lock',
  keyboardLock: 'keyboard-lock',
  'speaker-selection': 'speaker-selection',
  mediaKeySystem: 'protected-media',
};

type MediaScope = 'audio' | 'video';

const KIND_BY_MEDIA_SCOPE: Record<MediaScope, BrowserSitePermissionKind> = {
  audio: 'microphone',
  video: 'camera',
};

const OS_MEDIA_TYPES: Partial<Record<BrowserSitePermissionKind, 'microphone' | 'camera'>> = {
  microphone: 'microphone',
  camera: 'camera',
};

export interface IntegratedBrowserPermissionGovernanceInput {
  session: Session;
  store: BrowserSitePermissionStore;
  isBrowserContents: (contents: WebContents | null) => boolean;
  getParentWindow: () => BrowserWindow | null;
  onChanged?: () => void;
}

export class IntegratedBrowserPermissionGovernance {
  private readonly requested = new Map<string, Set<BrowserSitePermissionKind>>();
  private readonly pending = new Map<string, Promise<boolean>>();
  /**
   * Los dialogos se muestran de uno en uno. Una videollamada pide camara y
   * microfono a la vez y desde varios marcos: dos cuadros modales sobre la
   * misma ventana se tapaban entre si y la solicitud quedaba esperando una
   * respuesta que el usuario no podia dar.
   */
  private dialogQueue: Promise<unknown> = Promise.resolve();
  private disposed = false;

  constructor(private readonly input: IntegratedBrowserPermissionGovernanceInput) {
    void input.store.warmUp().catch(() => undefined);
    input.session.setPermissionCheckHandler((contents, permission, origin, details) => (
      this.check(contents, permission, origin, details)
    ));
    input.session.setPermissionRequestHandler((contents, permission, callback, details) => {
      void this.request(contents, permission, details)
        .then((granted) => callback(granted))
        .catch(() => callback(false));
    });
  }

  dispose(): void {
    this.disposed = true;
    this.requested.clear();
    this.pending.clear();
    this.input.session.setPermissionCheckHandler(null);
    this.input.session.setPermissionRequestHandler(null);
  }

  async getSummary(url: string): Promise<BrowserSitePermissionSummary> {
    const origin = normalizeOrigin(url);
    const states = origin
      ? await this.input.store.list(origin)
      : null;
    const requested = origin ? this.requested.get(origin) : undefined;
    return {
      origin,
      url: typeof url === 'string' ? url : '',
      secure: origin ? origin.startsWith('https://') : false,
      permissions: BROWSER_SITE_PERMISSION_KINDS.map((kind) => ({
        kind,
        label: BROWSER_SITE_PERMISSION_LABELS[kind],
        state: states?.[kind] ?? 'ask',
        requested: requested?.has(kind) ?? false,
      })),
    };
  }

  async setPermission(origin: string, kind: BrowserSitePermissionKind, state: BrowserSitePermissionState): Promise<void> {
    const normalized = normalizeOrigin(origin);
    if (!normalized) throw new Error('El origen del permiso no es valido.');
    // Conceder camara o microfono desde el panel no sirve de nada si el sistema
    // los tiene bloqueados: se avisa aqui en vez de dejar que la pagina falle.
    if (state === 'granted') {
      const blocked = await this.requestOsMediaAccess([kind]);
      if (blocked.length) {
        this.showOsBlockedDialog(blocked);
        throw new Error(`El sistema tiene bloqueado el acceso a ${describeKinds(blocked)}.`);
      }
    }
    await this.input.store.set(normalized, kind, state);
    this.input.onChanged?.();
  }

  async resetOrigin(origin: string): Promise<void> {
    const normalized = normalizeOrigin(origin);
    if (!normalized) throw new Error('El origen del permiso no es valido.');
    await this.input.store.reset(normalized);
    this.requested.delete(normalized);
    this.input.onChanged?.();
  }

  private check(
    contents: WebContents | null,
    permission: ElectronCheckPermission,
    origin: string,
    details: unknown,
  ): boolean {
    if (this.disposed || !this.input.isBrowserContents(contents)) return false;
    if (AUTO_GRANTED_PERMISSIONS.has(permission)) return true;
    const kind = resolveCheckedKind(permission, details);
    if (!kind) return false;
    const state = this.input.store.resolveSync(origin, kind);
    if (state === 'denied') return false;
    if (state === 'granted') return true;
    // `navigator.permissions.query` no distingue "sin decidir" de "denegado":
    // Electron solo admite un booleano. Devolver falso hacia que sitios como
    // Google Meet mostraran "no puede usar el microfono" y nunca llamaran a
    // getUserMedia, de modo que el permiso no se podia conceder nunca. La
    // concesion real sigue ocurriendo en `request`, que si abre el dialogo.
    return PROMPTABLE_ON_CHECK.has(kind);
  }

  private async request(
    contents: WebContents,
    permission: ElectronRequestPermission,
    details: unknown,
  ): Promise<boolean> {
    if (this.disposed || !this.input.isBrowserContents(contents)) return false;
    if (AUTO_GRANTED_PERMISSIONS.has(permission)) return true;

    const origin = resolvePermissionOrigin(details, contents.getURL());
    const kinds = resolveRequestedKinds(permission, details);
    if (!origin || !kinds.length) return false;

    this.trackRequested(origin, kinds);
    console.info(`[Navegador][Permisos] ${origin} solicita ${kinds.join(', ')}.`);
    // Una peticion de camara y microfono llega junta y Electron solo admite un
    // booleano para toda ella: basta con que una este denegada para que el
    // sitio deba replantear su llamada.
    const results = await Promise.all(kinds.map((kind) => this.resolveKind(origin, kind)));
    const concedido = results.every(Boolean);
    console.info(`[Navegador][Permisos] ${origin} → ${kinds.join(', ')}: ${concedido ? 'concedido' : 'denegado'}.`);
    return concedido;
  }

  private resolveKind(origin: string, kind: BrowserSitePermissionKind): Promise<boolean> {
    const key = `${origin}|${kind}`;
    const existing = this.pending.get(key);
    // Meet pide microfono y camara desde varios marcos a la vez; sin esta cola
    // el usuario recibia un dialogo por cada uno.
    if (existing) return existing;
    const resolution = this.resolveKindUncached(origin, kind).finally(() => this.pending.delete(key));
    this.pending.set(key, resolution);
    return resolution;
  }

  private async resolveKindUncached(origin: string, kind: BrowserSitePermissionKind): Promise<boolean> {
    const stored = await this.input.store.resolve(origin, kind);
    if (stored === 'denied') return false;

    if (stored === 'ask') {
      const blockedBeforeAsking = this.inspectOsMediaAccess([kind]);
      if (blockedBeforeAsking.length) {
        this.showOsBlockedDialog(blockedBeforeAsking);
        return false;
      }
      const approved = await this.askUser(origin, kind);
      await this.input.store.set(origin, kind, approved ? 'granted' : 'denied');
      this.input.onChanged?.();
      if (!approved) return false;
    }

    const blocked = await this.requestOsMediaAccess([kind]);
    if (blocked.length) {
      this.showOsBlockedDialog(blocked);
      return false;
    }
    return true;
  }

  private askUser(origin: string, kind: BrowserSitePermissionKind): Promise<boolean> {
    const etiqueta = BROWSER_SITE_PERMISSION_LABELS[kind].toLocaleLowerCase('es');
    return this.enqueueDialog(async () => {
      if (this.disposed) return false;
      const parent = this.input.getParentWindow();
      const options = {
        type: 'question' as const,
        title: 'Permiso del navegador',
        message: `¿Permitir acceso a ${etiqueta}?`,
        detail: `${origin}\n\nLa decision queda guardada para este origen y puedes cambiarla desde el boton del sitio en la barra de direcciones.`,
        // Denegar sigue siendo la respuesta por omision: un Enter accidental
        // no debe abrir la camara.
        buttons: ['Denegar', 'Permitir'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      };
      const { response } = parent && !parent.isDestroyed()
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options);
      const concedido = response === 1;
      console.info(`[Navegador][Permisos] ${etiqueta} en ${origin}: ${concedido ? 'permitido' : 'denegado'}.`);
      return concedido;
    });
  }

  /**
   * Encola un cuadro de dialogo detras de los anteriores y garantiza que
   * siempre termine. Un fallo al mostrarlo se resuelve como negativa: dejar la
   * promesa pendiente colgaba la solicitud de la pagina para siempre, y con
   * ella la llamada que la origino.
   */
  private enqueueDialog(run: () => Promise<boolean>): Promise<boolean> {
    const resultado = this.dialogQueue.then(run, run).catch((error) => {
      console.warn('[Navegador][Permisos] No se pudo mostrar el cuadro de permiso:', error);
      return false;
    });
    this.dialogQueue = resultado;
    return resultado;
  }

  private trackRequested(origin: string, kinds: BrowserSitePermissionKind[]): void {
    const entry = this.requested.get(origin) ?? new Set<BrowserSitePermissionKind>();
    for (const kind of kinds) entry.add(kind);
    this.requested.set(origin, entry);
    this.input.onChanged?.();
  }

  private inspectOsMediaAccess(kinds: BrowserSitePermissionKind[]): BrowserSitePermissionKind[] {
    if (!supportsOsMediaAccess()) return [];
    return kinds.filter((kind) => {
      const mediaType = OS_MEDIA_TYPES[kind];
      if (!mediaType) return false;
      const status = systemPreferences.getMediaAccessStatus(mediaType);
      return status === 'denied' || status === 'restricted';
    });
  }

  private async requestOsMediaAccess(kinds: BrowserSitePermissionKind[]): Promise<BrowserSitePermissionKind[]> {
    if (!supportsOsMediaAccess()) return [];
    const blocked: BrowserSitePermissionKind[] = [];
    for (const kind of kinds) {
      const mediaType = OS_MEDIA_TYPES[kind];
      if (!mediaType) continue;
      let status = systemPreferences.getMediaAccessStatus(mediaType);
      // `askForMediaAccess` solo existe en macOS; en Windows el estado lo cambia
      // el usuario desde Configuracion y no hay dialogo que invocar.
      if (status === 'not-determined' && process.platform === 'darwin') {
        const accepted = await systemPreferences.askForMediaAccess(mediaType).catch(() => false);
        status = accepted ? 'granted' : 'denied';
      }
      if (status === 'denied' || status === 'restricted') blocked.push(kind);
    }
    return blocked;
  }

  private showOsBlockedDialog(kinds: BrowserSitePermissionKind[]): void {
    const parent = this.input.getParentWindow();
    const ruta = process.platform === 'darwin'
      ? 'Ajustes del Sistema > Privacidad y seguridad'
      : 'Configuracion > Privacidad y seguridad';
    const options = {
      type: 'warning' as const,
      title: 'Permiso del sistema bloqueado',
      message: `El sistema tiene bloqueado el acceso a ${describeKinds(kinds)}.`,
      detail: `Habilitalo en ${ruta} para Pulse Hub y vuelve a intentarlo desde la pagina.`,
      buttons: ['Entendido'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const shown = parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options);
    void shown.catch(() => {});
  }
}

/**
 * Permisos cuyo estado "sin decidir" se reporta como concedido a
 * `navigator.permissions.query`. Solo entran los que la pagina consulta antes
 * de pedirlos de verdad y que quedan cubiertos por un dialogo posterior; el
 * resto sigue respondiendo que no para no exagerar lo que el sitio tiene.
 */
const PROMPTABLE_ON_CHECK = new Set<BrowserSitePermissionKind>([
  'camera',
  'microphone',
  'speaker-selection',
]);

// Linux no expone estado de permisos de captura: lo resuelve el servidor de
// audio/video y consultar aqui devolveria siempre `unknown`.
function supportsOsMediaAccess(): boolean {
  return process.platform === 'darwin' || process.platform === 'win32';
}

function describeKinds(kinds: BrowserSitePermissionKind[]): string {
  return kinds.map((kind) => BROWSER_SITE_PERMISSION_LABELS[kind].toLocaleLowerCase('es')).join(' y ');
}

function resolveCheckedKind(permission: string, details: unknown): BrowserSitePermissionKind | null {
  if (permission !== 'media') return PERMISSION_KIND_BY_NAME[permission] ?? null;
  const mediaType = details && typeof details === 'object'
    ? (details as { mediaType?: unknown }).mediaType
    : null;
  if (mediaType === 'audio' || mediaType === 'video') return KIND_BY_MEDIA_SCOPE[mediaType];
  return null;
}

function resolveRequestedKinds(permission: string, details: unknown): BrowserSitePermissionKind[] {
  if (permission !== 'media') {
    const kind = PERMISSION_KIND_BY_NAME[permission];
    return kind ? [kind] : [];
  }
  const mediaTypes = details && typeof details === 'object'
    ? (details as { mediaTypes?: unknown }).mediaTypes
    : null;
  if (!Array.isArray(mediaTypes)) return [];
  const scopes = mediaTypes.filter((value): value is MediaScope => value === 'audio' || value === 'video');
  return [...new Set(scopes.map((scope) => KIND_BY_MEDIA_SCOPE[scope]))];
}

function resolvePermissionOrigin(details: unknown, fallbackUrl: string): string | null {
  const candidate = details && typeof details === 'object'
    ? (details as { requestingUrl?: unknown; securityOrigin?: unknown })
    : {};
  const raw = typeof candidate.securityOrigin === 'string' && candidate.securityOrigin
    ? candidate.securityOrigin
    : typeof candidate.requestingUrl === 'string' && candidate.requestingUrl
      ? candidate.requestingUrl
      : fallbackUrl;
  return normalizeOrigin(raw);
}
