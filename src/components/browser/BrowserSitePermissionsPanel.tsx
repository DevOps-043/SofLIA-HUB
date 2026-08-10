import { useCallback, useEffect, useRef, useState } from 'react';
import {
  integratedBrowserService,
  type BrowserSitePermissionEntry,
  type BrowserSitePermissionKind,
  type BrowserSitePermissionState,
  type BrowserSitePermissionSummary,
} from '../../services/integrated-browser-service';

/**
 * Panel del botón del sitio, equivalente al candado de un navegador. Existe
 * porque los permisos del navegador integrado se conceden por origen y el
 * usuario necesita poder revisarlos y revocarlos sin esperar a que la página
 * los vuelva a pedir.
 */
export function BrowserSitePermissionsPanel(props: {
  open: boolean;
  url: string;
  onClose: () => void;
}) {
  const [site, setSite] = useState<BrowserSitePermissionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BrowserSitePermissionKind | 'reset' | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!integratedBrowserService.isAvailable()) return;
    const requestId = ++requestIdRef.current;
    try {
      const response = await integratedBrowserService.getSitePermissions();
      if (requestId !== requestIdRef.current) return;
      if (!response.success) {
        setError(response.error ?? 'No se pudieron leer los permisos del sitio.');
        return;
      }
      setSite(response.site ?? null);
      setError(null);
    } catch {
      if (requestId === requestIdRef.current) setError('No se pudieron leer los permisos del sitio.');
    }
  }, []);

  useEffect(() => {
    if (!props.open) return undefined;
    let activo = true;
    const cargar = () => { if (activo) void refresh(); };
    // La primera lectura sale del cuerpo del efecto para no encadenar un
    // render con el estado que aun no ha llegado del proceso principal.
    queueMicrotask(cargar);
    if (!integratedBrowserService.isAvailable()) return () => { activo = false; };
    // El proceso principal avisa cuando la propia pagina solicita un permiso:
    // el panel abierto debe reflejarlo sin que el usuario lo cierre y reabra.
    const unsubscribe = integratedBrowserService.subscribe({ onSitePermissionsChanged: cargar });
    return () => { activo = false; unsubscribe(); };
  }, [props.open, props.url, refresh]);

  const applyState = async (kind: BrowserSitePermissionKind, state: BrowserSitePermissionState) => {
    setBusy(kind);
    setError(null);
    try {
      const response = await integratedBrowserService.setSitePermission({ kind, state });
      if (!response.success) setError(response.error ?? 'No se pudo cambiar el permiso.');
      else setSite(response.site ?? null);
    } catch {
      setError('No se pudo cambiar el permiso.');
    } finally {
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy('reset');
    setError(null);
    try {
      const response = await integratedBrowserService.resetSitePermissions();
      if (!response.success) setError(response.error ?? 'No se pudieron restablecer los permisos.');
      else setSite(response.site ?? null);
    } catch {
      setError('No se pudieron restablecer los permisos.');
    } finally {
      setBusy(null);
    }
  };

  if (!props.open) return null;

  const visible = site ? orderPermissions(site.permissions) : [];

  return (
    <div
      role="dialog"
      aria-label="Permisos del sitio"
      className="absolute left-0 top-[calc(100%+0.375rem)] z-[85] w-[22rem] max-w-[92vw] overflow-hidden rounded-2xl border border-gray-200/80 bg-white/98 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#161b22]/98"
    >
      <div className="flex items-start gap-2 border-b border-gray-200/70 px-3.5 py-3 dark:border-white/[0.08]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary dark:text-white/90">
            {site?.origin ? hostOf(site.origin) : 'Sitio no disponible'}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-secondary">
            <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {site?.secure
                ? <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>
                : <><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></>}
            </svg>
            {site?.secure ? 'La conexión es segura' : 'La conexión no es segura'}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Cerrar permisos del sitio"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-secondary transition hover:bg-gray-100 dark:hover:bg-white/[0.06]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      {!site?.origin ? (
        <p className="px-3.5 py-4 text-xs text-secondary">
          Abre una página web para administrar sus permisos.
        </p>
      ) : (
        <>
          <ul className="max-h-[19rem] overflow-y-auto p-1.5">
            {visible.map((entry) => (
              <li key={entry.kind} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-gray-100/70 dark:hover:bg-white/[0.04]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-primary dark:text-white/90">{entry.label}</span>
                  <span className="block text-[10px] text-secondary">
                    {entry.state === 'granted' ? 'Permitido' : entry.state === 'denied' ? 'Bloqueado' : 'Preguntar'}
                    {entry.requested && entry.state === 'ask' ? ' · lo solicitó esta página' : ''}
                  </span>
                </span>
                <select
                  aria-label={`Permiso de ${entry.label}`}
                  value={entry.state}
                  disabled={busy !== null}
                  onChange={(event) => void applyState(entry.kind, event.target.value as BrowserSitePermissionState)}
                  className="h-7 shrink-0 rounded-lg border border-gray-200 bg-white px-1.5 text-[11px] text-primary outline-none transition focus:border-accent disabled:opacity-50 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-white/90"
                >
                  <option value="ask">Preguntar</option>
                  <option value="granted">Permitir</option>
                  <option value="denied">Bloquear</option>
                </select>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200/70 px-3.5 py-2.5 dark:border-white/[0.08]">
            {error && <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => void reset()}
              disabled={busy !== null}
              className="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/[0.1] dark:text-white/90 dark:hover:bg-white/[0.06]"
            >
              Restablecer permisos
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Lo que la página pidió va primero, y después las categorías que un usuario
 * revisa de verdad. El resto queda al final para no convertir el panel en una
 * lista de trece interruptores donde no se encuentra la cámara.
 */
const PRIORITY: BrowserSitePermissionKind[] = [
  'camera',
  'microphone',
  'display-capture',
  'notifications',
  'geolocation',
  'clipboard-read',
];

function orderPermissions(entries: BrowserSitePermissionEntry[]): BrowserSitePermissionEntry[] {
  return [...entries].sort((left, right) => rank(left) - rank(right));
}

function rank(entry: BrowserSitePermissionEntry): number {
  if (entry.requested) return -1;
  const index = PRIORITY.indexOf(entry.kind);
  return index >= 0 ? index : PRIORITY.length + 1;
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
