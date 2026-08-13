import { useCallback, useEffect, useState } from 'react';
import {
  integratedBrowserService,
  type BrowserPermissionPromptRequest,
} from '../../services/integrated-browser-service';

/**
 * Globo de permiso del navegador, anclado bajo la barra de direcciones igual
 * que en un navegador de escritorio.
 *
 * Antes esto era un cuadro modal del sistema: bloqueaba toda la ventana, no se
 * parecia a lo que el usuario espera de un navegador y aparecia una vez por
 * cada permiso. El proceso principal ya agrupa en un solo aviso todo lo que la
 * pagina pide a la vez, asi que aqui basta con pintarlo y responder.
 *
 * Los avisos que llegan mientras hay uno abierto se encolan: dos globos
 * superpuestos dejarian al usuario sin saber a que sitio esta respondiendo.
 */
export function BrowserPermissionPrompt({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [queue, setQueue] = useState<BrowserPermissionPromptRequest[]>([]);

  const active = queue[0] ?? null;

  useEffect(() => {
    if (!integratedBrowserService.isAvailable()) return undefined;
    return integratedBrowserService.subscribe({
      onPermissionPrompt: (request) => {
        if (!request || typeof request.id !== 'string' || !Array.isArray(request.kinds)) return;
        setQueue((current) => (
          current.some((pending) => pending.id === request.id) ? current : [...current, request]
        ));
      },
    });
  }, []);

  useEffect(() => {
    onOpenChange?.(Boolean(active));
  }, [active, onOpenChange]);

  const decide = useCallback((request: BrowserPermissionPromptRequest, granted: boolean) => {
    setQueue((current) => current.filter((pending) => pending.id !== request.id));
    if (!integratedBrowserService.isAvailable()) return;
    // Una respuesta que no llega deja a la pagina esperando, asi que el fallo
    // se registra pero no se reintenta: el proceso principal deniega por
    // vencimiento si nadie contesta.
    void integratedBrowserService
      .decidePermissionPrompt({ id: request.id, granted })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      // Escape deniega: cerrar sin decidir dejaria la peticion viva y la pagina
      // esperando, y abrir la camara nunca puede ser la salida por descarte.
      if (event.key === 'Escape') decide(active, false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, decide]);

  if (!active) return null;

  const etiquetas = active.labels?.length ? active.labels : active.kinds;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Permiso del sitio"
      data-testid="browser-permission-prompt"
      className="absolute left-0 top-[calc(100%+0.375rem)] z-[90] w-full max-w-[26rem] rounded-2xl border border-gray-200/80 bg-white/98 p-4 shadow-xl shadow-black/10 backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#161b22]/98"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent" aria-hidden="true">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white/90">
            ¿Permitir acceso a {formatList(etiquetas)}?
          </p>
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-white/50" title={active.origin}>
            {active.origin}
          </p>
          <p className="mt-2 text-xs text-gray-500 dark:text-white/50">
            La decisión queda guardada para este sitio. Puedes cambiarla desde el botón del candado.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => decide(active, false)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:text-white/60 dark:hover:bg-white/[0.08]"
        >
          Bloquear
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => decide(active, true)}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-on-accent shadow-xs transition-all duration-200 hover:shadow-md hover:shadow-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Permitir
        </button>
      </div>
    </div>
  );
}

function formatList(values: string[]): string {
  const limpias = values.map((value) => value.toLocaleLowerCase('es'));
  if (limpias.length <= 1) return limpias[0] ?? 'este permiso';
  return `${limpias.slice(0, -1).join(', ')} y ${limpias[limpias.length - 1]}`;
}
