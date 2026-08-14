import { useEffect, useState } from 'react';

/**
 * Indicador de escucha activa.
 *
 * Es una guarda de privacidad, no un adorno: mientras SofLIA captura audio del
 * equipo o del microfono el usuario tiene que verlo y poder detenerlo en el
 * acto, sin buscar la opcion en un menu.
 */
export function AmbientListeningIndicator(props: {
  source: 'sistema' | 'microfono';
  startedAt: number;
  maxSeconds: number;
  onStop: () => void;
}) {
  const [transcurrido, setTranscurrido] = useState(0);

  useEffect(() => {
    const actualizar = () => setTranscurrido(Math.floor((Date.now() - props.startedAt) / 1000));
    actualizar();
    const temporizador = setInterval(actualizar, 1000);
    return () => clearInterval(temporizador);
  }, [props.startedAt]);

  const restante = Math.max(0, props.maxSeconds - transcurrido);
  const fuente = props.source === 'sistema' ? 'el audio del equipo' : 'el micrófono';

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm"
    >
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      <span className="flex-1 text-neutral-800 dark:text-neutral-100">
        Escuchando {fuente} · {formatearSegundos(transcurrido)}
        <span className="ml-1 text-neutral-500 dark:text-neutral-400">
          (se detiene en {formatearSegundos(restante)})
        </span>
      </span>
      <button
        type="button"
        onClick={props.onStop}
        className="rounded-lg border border-red-500/40 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/15 dark:text-red-300"
      >
        Detener
      </button>
    </div>
  );
}

function formatearSegundos(total: number): string {
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${String(segundos).padStart(2, '0')}`;
}
