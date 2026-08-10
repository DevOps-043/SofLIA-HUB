import { useMemo, useState } from 'react';
import { highlightCode } from './code-highlight';
import { fileKind } from './file-kind';

/**
 * Visor del archivo seleccionado con resaltado y numeros de linea.
 *
 * El codigo NO se ajusta de linea: se desplaza en horizontal. Envolver una
 * etiqueta HTML larga rompe la lectura y es lo que hacia que el panel se viera
 * como un bloque de texto en vez de como codigo.
 *
 * Una imagen se muestra como imagen. Antes se leia como texto y se pintaba un
 * nodo por linea: un PNG de medio mega bloqueaba la aplicacion.
 */

/**
 * Tope de lineas pintadas. Cada linea es un nodo del DOM en la columna de
 * numeros; por encima de esto el desplazamiento se vuelve pesado y el archivo
 * ya no se revisa leyendo, se revisa abriendo la carpeta.
 */
const MAX_LINEAS = 4_000;

export function PresentationCodeViewer(props: {
  path: string | null;
  content: string;
  imageUrl?: string | null;
  error?: string;
  /** Ausente cuando el archivo no se puede editar (protegido o binario). */
  onSave?: (content: string) => Promise<{ ok: boolean; message: string }>;
}) {
  const kind = fileKind(props.path);
  const [borrador, setBorrador] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const visible = borrador ?? props.content;
  const recortado = useMemo(() => {
    const lineas = visible.split('\n');
    return lineas.length > MAX_LINEAS
      ? { lineas: lineas.slice(0, MAX_LINEAS), texto: lineas.slice(0, MAX_LINEAS).join('\n'), total: lineas.length }
      : { lineas, texto: visible, total: lineas.length };
  }, [visible]);

  const resaltado = useMemo(
    () => (props.path && kind === 'texto' ? highlightCode(props.path, recortado.texto) : null),
    [kind, props.path, recortado.texto],
  );

  if (!props.path) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-[12px] text-secondary">Selecciona un archivo para ver su contenido.</p>
      </div>
    );
  }

  if (kind === 'imagen') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-auto bg-surface-2 p-3">
          {props.imageUrl ? (
            <img
              src={props.imageUrl}
              alt={props.path}
              className="mx-auto max-h-full max-w-full rounded-xl object-contain shadow-lg"
            />
          ) : (
            <p className="pt-8 text-center text-[12px] text-secondary">Cargando la imagen…</p>
          )}
        </div>
      </div>
    );
  }

  if (kind === 'binario') {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-[12px] text-secondary">
          Este archivo no es de texto. Abre la carpeta para revisarlo.
        </p>
      </div>
    );
  }

  const editable = Boolean(props.onSave);
  const sinGuardar = borrador !== null && borrador !== props.content;

  const guardar = async () => {
    if (!props.onSave || borrador === null) return;
    setGuardando(true);
    const resultado = await props.onSave(borrador);
    setGuardando(false);
    setAviso(resultado.message);
    if (resultado.ok) setBorrador(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {props.error && (
        <p role="alert" className="shrink-0 border-b border-danger/20 bg-danger/[0.07] px-3 py-2 text-[11px] text-danger">
          {props.error}
        </p>
      )}

      {(editable || aviso) && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <span className="truncate text-[10.5px] text-secondary">
            {aviso ?? (sinGuardar ? 'Cambios sin guardar' : '')}
          </span>
          {editable && (
            <div className="flex shrink-0 items-center gap-1">
              {borrador === null ? (
                <button
                  type="button"
                  onClick={() => { setBorrador(props.content); setAviso(null); }}
                  className="rounded-lg border border-border px-2.5 py-1 text-[10.5px] font-semibold text-secondary transition hover:text-primary dark:hover:text-white"
                >
                  Editar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setBorrador(null); setAviso(null); }}
                    className="rounded-lg px-2 py-1 text-[10.5px] font-semibold text-secondary transition hover:text-primary dark:hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void guardar()}
                    disabled={!sinGuardar || guardando}
                    className="rounded-lg bg-accent px-2.5 py-1 text-[10.5px] font-semibold text-on-accent transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {recortado.total > MAX_LINEAS && (
        <p className="shrink-0 border-b border-border px-3 py-1.5 text-[10.5px] text-secondary">
          Se muestran las primeras {MAX_LINEAS} lineas de {recortado.total}. Abre la carpeta para verlo completo.
        </p>
      )}

      {borrador !== null ? (
        <textarea
          value={borrador}
          onChange={(event) => setBorrador(event.target.value)}
          spellCheck={false}
          aria-label={`Editar ${props.path}`}
          className="min-h-0 flex-1 resize-none bg-transparent px-3 py-3 font-mono text-[11px] leading-[1.6] text-primary outline-none dark:text-white"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-w-full">
            {/* Columna de numeros: pegada a la izquierda al desplazar en horizontal. */}
            <div
              aria-hidden="true"
              className="sticky left-0 z-10 shrink-0 select-none border-r border-border bg-card px-2 py-3 text-right font-mono text-[11px] leading-[1.6] text-secondary/50"
            >
              {recortado.lineas.map((_, indice) => (
                <div key={indice}>{indice + 1}</div>
              ))}
            </div>

            <pre className="hljs min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-[11px] leading-[1.6]">
              {resaltado
                // highlight.js escapa el contenido y solo emite <span class>:
                // el HTML que llega aqui no puede contener marcado del modelo.
                // Si el resaltado falla o el archivo es enorme, `resaltado` es
                // null y se pinta como texto plano.
                ? <code dangerouslySetInnerHTML={{ __html: resaltado }} />
                : <code>{recortado.texto}</code>}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
