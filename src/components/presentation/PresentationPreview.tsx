import { useEffect, useRef, useState } from 'react';
import { workspaceApi } from '../../services/skills/workspace-bridge';

/**
 * Vista previa embebida de la presentacion.
 *
 * Se sirve por el protocolo local en un `iframe` con `sandbox="allow-scripts"`
 * y SIN `allow-same-origin`. Esa combinacion deja el documento en un origen
 * opaco: no alcanza el `localStorage` del renderer, no tiene un `window.parent`
 * util y no ve las APIs que preload expone en el mundo principal. La CSP que
 * envia el protocolo cierra ademas cualquier peticion de red.
 *
 * Se renderiza sobre un LIENZO FIJO de 16:9 y se escala para caber en el panel.
 * Antes el `iframe` tomaba el ancho real del panel: una baraja compuesta para
 * una pantalla ancha se veia en una columna estrecha, el contenido crecia a lo
 * alto y el titulo quedaba fuera de vista. Con el lienzo fijo, la vista previa
 * muestra exactamente lo mismo que la pantalla completa, solo mas pequeno.
 */

/** Lienzo de composicion: la proporcion de una pantalla de presentacion. */
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

type QualityReport = {
  ok: boolean;
  incidencias: { diapositiva: number; codigo: string }[];
};

export function PresentationPreview(props: {
  workspaceId: string;
  ready: boolean;
  /** Cambia cuando el contenido se regenera, para forzar la recarga. */
  revision: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qualityState, setQualityState] = useState<{
    revision: string;
    url: string;
    report: QualityReport;
  } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { contenedor, escala } = useCanvasScale();

  useEffect(() => {
    const api = workspaceApi();
    // Mientras no esta lista no se pide URL. El render ya no la muestra por
    // la guarda de abajo, asi que no hace falta limpiarla aqui.
    if (!api || !props.ready) return undefined;

    let cancelled = false;
    void api.previewUrl(props.workspaceId).then((response) => {
      if (cancelled) return;
      if (response.success && response.url) {
        setUrl(response.url);
        setError(null);
      } else {
        setUrl(null);
        setError(response.error ?? 'La presentacion todavia no esta lista.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [props.ready, props.revision, props.workspaceId]);

  useEffect(() => {
    const receiveReport = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isQualityMessage(event.data)) return;
      if (!url) return;
      setQualityState({ revision: props.revision, url, report: event.data.informe });
    };
    window.addEventListener('message', receiveReport);
    return () => window.removeEventListener('message', receiveReport);
  }, [props.revision, url]);

  const qualityReport = qualityState?.revision === props.revision && qualityState.url === url
    ? qualityState.report
    : null;

  if (!props.ready || !url) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-[13px] text-secondary">
          {error ?? 'La presentacion todavia no esta lista. SofLIA la esta escribiendo.'}
        </p>
      </div>
    );
  }

  return (
    <div ref={contenedor} className="relative grid h-full w-full place-items-center overflow-hidden">
      {qualityReport ? (
        <div
          role="status"
          className={`absolute right-2 top-2 z-10 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
            qualityReport.ok
              ? 'bg-emerald-500/90 text-white'
              : 'bg-amber-500/95 text-slate-950'
          }`}
        >
          {qualityReport.ok
            ? 'Calidad visual: sin incidencias'
            : `${qualityReport.incidencias.length} incidencias visuales`}
        </div>
      ) : null}
      <div
        style={{
          width: CANVAS_WIDTH * escala,
          height: CANVAS_HEIGHT * escala,
        }}
        className="overflow-hidden"
      >
        <iframe
          ref={iframeRef}
          // La clave fuerza un remonte cuando el contenido cambia: recargar el
          // mismo `src` no basta porque el navegador reutiliza el documento.
          key={`${url}#${props.revision}`}
          title="Vista previa de la presentacion"
          src={url}
          // Sin `allow-same-origin`: el documento queda en un origen opaco y no
          // puede alcanzar el renderer ni sus APIs privilegiadas.
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `scale(${escala})`,
            transformOrigin: 'top left',
          }}
          className="border-0 bg-white"
        />
      </div>
    </div>
  );
}

function isQualityMessage(value: unknown): value is { tipo: 'pulse-presentacion-calidad'; informe: QualityReport } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { tipo?: unknown; informe?: { ok?: unknown; incidencias?: unknown } };
  return candidate.tipo === 'pulse-presentacion-calidad'
    && typeof candidate.informe?.ok === 'boolean'
    && Array.isArray(candidate.informe.incidencias);
}

/** Escala que hace caber el lienzo fijo dentro del espacio disponible. */
function useCanvasScale() {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(1);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || typeof ResizeObserver !== 'function') return undefined;

    const medir = () => {
      const { width, height } = nodo.getBoundingClientRect();
      if (!width || !height) return;
      setEscala(Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT, 1));
    };

    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return { contenedor, escala };
}
