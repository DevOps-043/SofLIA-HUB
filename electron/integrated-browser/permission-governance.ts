import { dialog, systemPreferences, type BrowserWindow, type Session, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { BrowserSitePermissionStore, normalizeOrigin } from './site-permissions';
import {
  BROWSER_SITE_PERMISSION_KINDS,
  BROWSER_SITE_PERMISSION_LABELS,
  type BrowserPermissionPromptRequest,
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
 * leer su propia sesion, `background-sync` mantiene el ciclo de vida ordinario
 * de los service workers y `clipboard-sanitized-write` es el copiar de toda la
 * web. Ninguno concede acceso a un dispositivo ni a una API privilegiada de
 * Electron; `background-sync` sí puede producir tráfico web ordinario dentro
 * del origen y la sesión de Chromium.
 */
const AUTO_GRANTED_PERMISSIONS = new Set([
  'background-sync',
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
  /**
   * Origen heredado de una ventana real adoptada. Un Document
   * Picture-in-Picture es `about:blank` y no tiene origen propio: el permiso se
   * decide contra el del abridor, como en cualquier navegador de escritorio.
   */
  resolveGovernedOrigin: (contents: WebContents | null | undefined) => string | null;
  getParentWindow: () => BrowserWindow | null;
  /**
   * Muestra el aviso y resuelve con la decision del usuario. Lo pinta el
   * renderer del navegador, no un cuadro del sistema: un modal nativo bloquea
   * la ventana y no se parece a lo que hace un navegador.
   */
  prompt: (request: BrowserPermissionPromptRequest) => Promise<boolean>;
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
  private readonly loggedDenials = new Set<string>();
  private loggedAnonymousMediaPreflight = false;

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
    contents: WebContents | null | undefined,
    permission: ElectronCheckPermission,
    origin: string,
    details: unknown,
  ): boolean {
    const scope = resolveCheckedPermissionOrigin(origin, details, contents?.getURL() ?? '')
      ?? this.input.resolveGovernedOrigin(contents);
    const kinds = resolveCheckedKinds(permission, details);
    if (this.disposed) {
      return this.denyCheck((scope ?? origin) || '(sin origen)', permission, 'contenido ajeno al navegador');
    }
    if (!this.isGovernedCheck(contents, details)) {
      if (isAnonymousMediaPreflight(contents, permission, origin, scope, details, kinds)) {
        if (!this.loggedAnonymousMediaPreflight) {
          this.loggedAnonymousMediaPreflight = true;
          console.info('[Navegador][Permisos] Preflight media sin identidad ni origen: permitido; la captura real permanece gobernada.');
        }
        return true;
      }
      return this.denyCheck((scope ?? origin) || '(sin origen)', permission, 'contenido ajeno al navegador');
    }
    if (AUTO_GRANTED_PERMISSIONS.has(permission)) return true;
    if (!kinds.length) return this.denyCheck(origin, permission, 'permiso no reconocido');
    // Chromium consulta con el origen vacio desde algunos marcos. Sin este
    // respaldo el almacen no encontraba el origen y devolvia "denegado", que
    // el sitio lee igual que una negativa del usuario.
    if (!scope) {
      // Una ventana creada con `window.open()` empieza en `about:blank`. En ese
      // intervalo Electron puede consultar camara/microfono sin `origin` ni
      // `requestingUrl`; responder `false` impide que Meet llegue a ejecutar
      // `getUserMedia` y, por tanto, que pase por `request`, donde si exigimos
      // origen, decision guardada y aprobacion del usuario. Este `true` solo
      // significa "puedes solicitarlo" y se limita a contenido ya adoptado por
      // el navegador; no concede acceso al dispositivo.
      if (permission === 'media' && kinds.some((kind) => PROMPTABLE_ON_CHECK.has(kind))) return true;
      return this.denyCheck(origin || '(sin origen)', permission, 'origen no identificable');
    }

    const states = kinds.map((kind) => this.input.store.resolveSync(scope, kind));
    if (states.includes('granted')) return true;
    if (states.every((state) => state === 'denied')) {
      return this.denyCheck(scope, kinds.join(', '), 'denegado por el usuario');
    }
    // `navigator.permissions.query` no distingue "sin decidir" de "denegado":
    // Electron solo admite un booleano. Devolver falso hacia que sitios como
    // Google Meet mostraran "no puede usar el microfono" y nunca llamaran a
    // getUserMedia, de modo que el permiso no se podia conceder nunca. La
    // concesion real sigue ocurriendo en `request`, que si abre el aviso.
    return kinds.some((kind) => PROMPTABLE_ON_CHECK.has(kind));
  }

  /**
   * Electron entrega `webContents` nulo o ausente para algunas consultas de permisos
   * que nacen en un iframe de origen cruzado. Esas consultas siguen
   * perteneciendo a esta sesion aislada; `embeddingOrigin` es la frontera que
   * permite distinguirlas de service workers u otros contenidos sin dueño.
   * La solicitud real de dispositivos nunca pasa por esta excepcion.
   */
  private isGovernedCheck(contents: WebContents | null | undefined, details: unknown): boolean {
    if (contents) return this.input.isBrowserContents(contents);
    if (!details || typeof details !== 'object') return false;
    const candidate = details as { embeddingOrigin?: unknown; isMainFrame?: unknown };
    return candidate.isMainFrame === false
      && typeof candidate.embeddingOrigin === 'string'
      && normalizeOrigin(candidate.embeddingOrigin) !== null;
  }

  /**
   * `navigator.permissions.query` se consulta muchas veces por segundo, asi que
   * cada negativa se registra una sola vez. Sin esto una pagina que se queda a
   * medias no deja rastro de que permiso le falto.
   */
  private denyCheck(origin: string, kind: string, motivo: string): boolean {
    const clave = `${origin}|${kind}|${motivo}`;
    if (!this.loggedDenials.has(clave)) {
      this.loggedDenials.add(clave);
      console.warn(`[Navegador][Permisos] Consulta denegada (${motivo}): ${origin} ${kind}`);
    }
    return false;
  }

  private async request(
    contents: WebContents,
    permission: ElectronRequestPermission,
    details: unknown,
  ): Promise<boolean> {
    if (this.disposed || !this.input.isBrowserContents(contents)) {
      console.warn(`[Navegador][Permisos] Solicitud rechazada por contenido ajeno al navegador: ${permission}.`);
      return false;
    }
    if (AUTO_GRANTED_PERMISSIONS.has(permission)) return true;

    // La concesion real exige que la propia solicitud traiga origen. El origen
    // heredado del abridor solo sirve para responder consultas provisionales:
    // conceder camara sobre un origen que la pagina no declaro seria conceder a
    // ciegas.
    const origin = resolvePermissionOrigin(details, contents.getURL());
    const kinds = resolveRequestedKinds(permission, details);
    if (!origin || !kinds.length) return false;

    this.trackRequested(origin, kinds);
    console.info(`[Navegador][Permisos] ${origin} solicita ${kinds.join(', ')}.`);
    // Una peticion de camara y microfono llega junta y Electron solo admite un
    // booleano para toda ella: basta con que una este denegada para que el
    // sitio deba replantear su llamada.
    const concedido = await this.resolveKinds(origin, kinds);
    console.info(`[Navegador][Permisos] ${origin} → ${kinds.join(', ')}: ${concedido ? 'concedido' : 'denegado'}.`);
    return concedido;
  }

  private resolveKinds(origin: string, kinds: BrowserSitePermissionKind[]): Promise<boolean> {
    const key = `${origin}|${[...kinds].sort().join('+')}`;
    const existing = this.pending.get(key);
    // Meet pide los mismos permisos desde varios marcos a la vez; sin esta cola
    // el usuario recibia un aviso por cada uno.
    if (existing) return existing;
    const resolution = this.resolveKindsUncached(origin, kinds).finally(() => this.pending.delete(key));
    this.pending.set(key, resolution);
    return resolution;
  }

  private async resolveKindsUncached(origin: string, kinds: BrowserSitePermissionKind[]): Promise<boolean> {
    const stored = await Promise.all(kinds.map((kind) => this.input.store.resolve(origin, kind)));
    if (stored.includes('denied')) return false;

    const porDecidir = kinds.filter((_, index) => stored[index] === 'ask');
    if (porDecidir.length) {
      const blockedBeforeAsking = this.inspectOsMediaAccess(porDecidir);
      if (blockedBeforeAsking.length) {
        this.showOsBlockedDialog(blockedBeforeAsking);
        return false;
      }
      if (!await this.askUser(origin, porDecidir)) return false;
    }

    const blocked = await this.requestOsMediaAccess(kinds);
    if (blocked.length) {
      this.showOsBlockedDialog(blocked);
      return false;
    }
    return true;
  }

  /**
   * Un unico aviso para todos los permisos que faltan, como el globo de un
   * navegador de escritorio. Se encola para que dos solicitudes simultaneas no
   * se solapen, y al llegar su turno vuelve a leer el almacen: si la solicitud
   * anterior ya decidio estos permisos, preguntar otra vez seria pedir al
   * usuario algo que ya concedio.
   */
  private askUser(origin: string, kinds: BrowserSitePermissionKind[]): Promise<boolean> {
    return this.enqueueDialog(async () => {
      if (this.disposed) return false;
      const pendientes: BrowserSitePermissionKind[] = [];
      for (const kind of kinds) {
        const state = await this.input.store.resolve(origin, kind);
        if (state === 'denied') return false;
        if (state === 'ask') pendientes.push(kind);
      }
      if (!pendientes.length) return true;

      const concedido = await this.input.prompt({
        id: randomUUID(),
        origin,
        kinds: pendientes,
        labels: pendientes.map((kind) => BROWSER_SITE_PERMISSION_LABELS[kind]),
      });
      for (const kind of pendientes) {
        await this.input.store.set(origin, kind, concedido ? 'granted' : 'denied');
      }
      this.input.onChanged?.();
      console.info(`[Navegador][Permisos] ${describeKinds(pendientes)} en ${origin}: ${concedido ? 'permitido' : 'denegado'}.`);
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

function resolveCheckedKinds(permission: string, details: unknown): BrowserSitePermissionKind[] {
  if (permission !== 'media') {
    const kind = PERMISSION_KIND_BY_NAME[permission];
    return kind ? [kind] : [];
  }
  const mediaType = details && typeof details === 'object'
    ? (details as { mediaType?: unknown }).mediaType
    : null;
  if (mediaType === 'audio' || mediaType === 'video') return [KIND_BY_MEDIA_SCOPE[mediaType]];
  // Chromium tambien consulta `media` sin decir que dispositivo, sobre todo
  // desde marcos embebidos. Responder que no dejaba a Google Meet leyendo
  // camara y microfono como bloqueados: abortaba el arranque de la llamada sin
  // llegar nunca a pedirlos, que es lo que ocurria al iniciarla desde Gmail.
  return ['microphone', 'camera'];
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

function resolveCheckedPermissionOrigin(origin: string, details: unknown, fallbackUrl: string): string | null {
  const candidate = details && typeof details === 'object'
    ? (details as { requestingUrl?: unknown; securityOrigin?: unknown })
    : {};
  const raw = typeof candidate.securityOrigin === 'string' && candidate.securityOrigin
    ? candidate.securityOrigin
    : typeof origin === 'string' && origin
      ? origin
      : typeof candidate.requestingUrl === 'string' && candidate.requestingUrl
        ? candidate.requestingUrl
        : fallbackUrl;
  return normalizeOrigin(raw);
}

/**
 * Electron 43 puede omitir tanto `webContents` como todos los orígenes en el
 * preflight de `media` que Meet ejecuta antes de `getUserMedia`. El handler ya
 * está instalado sobre la partición aislada del navegador, así que permitir
 * esta consulta no concede captura. La solicitud real continúa pasando por
 * `request`, donde se exige una instancia registrada y un origen HTTP(S).
 * Si Electron sí aporta una identidad u origen explícito inválido, no usamos
 * este respaldo y la consulta falla cerrada. Electron 43.3 puede representar la
 * identidad ausente como `undefined` aunque el contrato público use `null`.
 */
function isAnonymousMediaPreflight(
  contents: WebContents | null | undefined,
  permission: string,
  origin: string,
  scope: string | null,
  details: unknown,
  kinds: BrowserSitePermissionKind[],
): boolean {
  if (contents != null || permission !== 'media' || scope !== null) return false;
  if (typeof origin === 'string' && origin.trim()) return false;
  if (!kinds.some((kind) => PROMPTABLE_ON_CHECK.has(kind))) return false;
  if (!details || typeof details !== 'object') return true;
  const candidate = details as Record<string, unknown>;
  return ['embeddingOrigin', 'requestingOrigin', 'securityOrigin', 'requestingUrl']
    .every((key) => typeof candidate[key] !== 'string' || !(candidate[key] as string).trim());
}
