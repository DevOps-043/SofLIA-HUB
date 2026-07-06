import type { InstalledAppEntry } from './installed-apps-index';

type Rect = { x: number; y: number; width: number; height: number };

export type EnvironmentWindowInfo = { title: string; process: string; pid: number };

export type EnvironmentMonitorInfo = {
  id: string;
  boundsDip: Rect;
  scaleFactor: number;
  primario: boolean;
};

export type EnvironmentContextPack = {
  ventanasAbiertas: EnvironmentWindowInfo[];
  ventanaActiva: { title: string; process: string } | null;
  monitores: EnvironmentMonitorInfo[];
  appsInstaladas: InstalledAppEntry[];
  generadoEn: number;
};

export type EnvironmentContextDeps = {
  listWindows: () => Promise<EnvironmentWindowInfo[]>;
  getActiveWindow: () => Promise<{ title: string; process: string } | null>;
  getMonitors: () => EnvironmentMonitorInfo[];
  getInstalledApps: () => Promise<InstalledAppEntry[]>;
  /** Presupuesto total para las fuentes asincronas; al agotarse se degrada a pack parcial. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 3000;
const MAX_WINDOWS_IN_PROMPT = 25;
const MAX_APPS_IN_PROMPT = 60;

/**
 * Construye el paquete de contexto del equipo (ventanas abiertas, monitores,
 * apps instaladas) para que el planner actue como un usuario que conoce su
 * maquina. Cada fuente falla de forma independiente: un timeout o error
 * produce un pack parcial, nunca bloquea la tarea.
 */
export async function buildEnvironmentContextPack(deps: EnvironmentContextDeps): Promise<EnvironmentContextPack> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const [ventanasAbiertas, ventanaActiva, appsInstaladas] = await Promise.all([
    withFallback(deps.listWindows(), [], timeoutMs, 'listWindows'),
    withFallback(deps.getActiveWindow(), null, timeoutMs, 'getActiveWindow'),
    withFallback(deps.getInstalledApps(), [], timeoutMs, 'installedApps'),
  ]);

  let monitores: EnvironmentMonitorInfo[] = [];
  try {
    monitores = deps.getMonitors();
  } catch (err) {
    console.warn('[DesktopAgent] Contexto de entorno sin monitores:', toErrorMessage(err));
  }

  return { ventanasAbiertas, ventanaActiva, monitores, appsInstaladas, generadoEn: Date.now() };
}

/** Formatea el pack como seccion de prompt en espanol, acotada en tamano. */
export function formatEnvironmentContextForPrompt(pack: EnvironmentContextPack): string {
  const lines: string[] = ['CONTEXTO DEL EQUIPO:'];

  if (pack.monitores.length > 0) {
    const monitores = pack.monitores
      .map((monitor, index) => `  ${index + 1}. ${monitor.boundsDip.width}x${monitor.boundsDip.height} en (${monitor.boundsDip.x}, ${monitor.boundsDip.y}), escala ${monitor.scaleFactor}x${monitor.primario ? ' [principal]' : ''}`)
      .join('\n');
    lines.push(`- Monitores (${pack.monitores.length}):\n${monitores}`);
  }

  if (pack.ventanaActiva) {
    lines.push(`- Ventana activa: "${pack.ventanaActiva.title}" (${pack.ventanaActiva.process})`);
  }

  if (pack.ventanasAbiertas.length > 0) {
    const ventanas = pack.ventanasAbiertas
      .slice(0, MAX_WINDOWS_IN_PROMPT)
      .map((ventana) => `  - "${ventana.title}" (${ventana.process})`)
      .join('\n');
    lines.push(`- Ventanas abiertas (${pack.ventanasAbiertas.length}):\n${ventanas}`);
  }

  if (pack.appsInstaladas.length > 0) {
    const apps = pack.appsInstaladas
      .slice(0, MAX_APPS_IN_PROMPT)
      .map((app) => app.nombre)
      .join(', ');
    lines.push(`- Apps instaladas disponibles para open_application: ${apps}`);
  }

  if (lines.length === 1) {
    lines.push('- (No se pudo obtener informacion del entorno; usa focus_window/open_application con precaucion.)');
  }
  return lines.join('\n');
}

async function withFallback<T>(promise: Promise<T>, fallback: T, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[DesktopAgent] Contexto de entorno: "${label}" supero ${timeoutMs}ms, se degrada a pack parcial.`);
      resolve(fallback);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } catch (err) {
    console.warn(`[DesktopAgent] Contexto de entorno: fallo "${label}":`, toErrorMessage(err));
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
