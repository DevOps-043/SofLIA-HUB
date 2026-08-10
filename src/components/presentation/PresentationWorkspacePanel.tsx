import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PresentationCodeViewer } from './PresentationCodeViewer';
import { PresentationFileTree } from './PresentationFileTree';
import { PresentationPreview } from './PresentationPreview';
import { usePresentationWorkspace } from './usePresentationWorkspace';
import { isEditableFile } from './file-kind';
import {
  PRESENTACIONES_BASE_CSS,
  PRESENTACIONES_BASE_JS,
  PRESENTACIONES_BRAND_CSS,
} from '../../shared/skills/presentaciones-skill';

const PRESENTACIONES_PROTECTED_FILES = [
  PRESENTACIONES_BRAND_CSS,
  PRESENTACIONES_BASE_CSS,
  PRESENTACIONES_BASE_JS,
];

type PanelTab = 'codigo' | 'vista';

const WIDTH_STORAGE_KEY = 'pulseHub_presentationPanelWidth';
const MIN_WIDTH = 260;
const MAX_WIDTH = 1100;
const DEFAULT_WIDTH = 460;

/**
 * Panel lateral de trabajo de una presentacion.
 *
 * Muestra en vivo que archivo escribe SofLIA y su contenido, y permite
 * reproducir el resultado sin salir del chat. Convive con el chat: no lo
 * sustituye, para que el usuario pueda seguir pidiendo cambios mientras la
 * generacion avanza.
 *
 * El ancho es ajustable y se recuerda: revisar codigo HTML en una columna fija
 * y estrecha obliga a desplazarse en horizontal en cada linea.
 */
export function PresentationWorkspacePanel(props: {
  workspaceId: string;
  onHide: () => void;
}) {
  const { state, selectFile, saveFile, openFolder, exportHtml, openFullscreen } = usePresentationWorkspace(props.workspaceId);
  const [tab, setTab] = useState<PanelTab>('codigo');
  const [aviso, setAviso] = useState<string | null>(null);
  const { width, isResizing, handlers } = usePanelWidth();

  // Identifica la version del contenido para que la vista previa se recargue
  // cuando los archivos cambian, sin recargarla en cada render.
  const revision = useMemo(
    () => state.files.map((file) => `${file.path}:${file.bytes}:${file.updatedAt}`).join('|'),
    [state.files],
  );

  // Los archivos que escribe el sistema (identidad, sistema de diseno y guion)
  // no se editan desde el panel: main los rechazaria igual, y ofrecer el boton
  // solo para ver el error seria enganoso.
  const editable = isEditableFile(state.selectedPath, PRESENTACIONES_PROTECTED_FILES);

  useAutoOpenPreview({
    ready: state.ready,
    writing: state.writingPath !== null,
    onOpen: () => setTab('vista'),
  });

  const handleReproducir = () => {
    if (!state.ready) {
      setAviso('La presentacion todavia no esta lista. Espera a que SofLIA termine de escribirla.');
      return;
    }
    setAviso(null);
    setTab('vista');
  };

  const handlePantallaCompleta = async () => {
    const result = await openFullscreen();
    if (!result.ok) setAviso(result.message);
  };

  const handleExportar = async () => {
    setAviso('Generando el archivo...');
    const resultado = await exportHtml();
    setAviso(resultado.message);
    // El archivo se escribe en la carpeta del proyecto: abrirla es lo que
    // convierte la exportacion en algo que el usuario puede usar de verdad.
    if (resultado.ok) await openFolder();
  };

  return (
    <section
      // Tarjeta flotante, no un panel pegado al borde: mismo lenguaje que el
      // chat flotante del navegador (esquinas redondeadas, borde completo y
      // sombra). Conserva su hueco en el flujo para no tapar la conversacion.
      className={`relative my-3 mr-3 flex h-[calc(100%-1.5rem)] min-h-0 shrink-0 flex-col overflow-hidden rounded-[1.5rem] border border-border bg-card/97 shadow-[0_1.5rem_3.5rem_rgba(2,12,23,0.28)] backdrop-blur-xl ${isResizing ? 'select-none' : ''}`}
      style={{ width }}
      aria-label="Panel de la presentacion"
      data-testid="presentation-workspace-panel"
    >
      <div
        role="separator"
        aria-label="Ajustar ancho del panel"
        aria-orientation="vertical"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={width}
        tabIndex={0}
        {...handlers}
        // DENTRO del panel: colocado fuera de su borde quedaba recortado por
        // `overflow-hidden` y era imposible de agarrar, asi que el ancho no se
        // podia cambiar. Ancho suficiente para acertarle con el puntero.
        className="group absolute inset-y-0 left-0 z-30 w-4 cursor-col-resize touch-none outline-none"
      >
        <span
          aria-hidden="true"
          className={`absolute left-1/2 top-1/2 h-16 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${
            isResizing ? 'bg-accent' : 'bg-border group-hover:bg-accent/60 group-focus:bg-accent'
          }`}
        />
      </div>

      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold leading-tight text-gray-900 dark:text-white">
            {state.workspace?.title ?? 'Presentacion'}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-secondary">
            {state.writingPath ? (
              <>
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
                <span className="truncate">Escribiendo {state.writingPath}</span>
              </>
            ) : (
              <span>{state.files.length} archivos</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton
            label="Presentar a pantalla completa"
            onClick={() => void handlePantallaCompleta()}
            disabled={!state.ready}
          >
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </IconButton>
          <IconButton label="Exportar como archivo HTML" onClick={() => void handleExportar()} disabled={!state.ready}>
            <path d="M12 3v11m0 0-4-4m4 4 4-4M4 19h16" />
          </IconButton>
          <IconButton label="Abrir la carpeta de la presentacion" onClick={() => void openFolder()}>
            <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z" />
          </IconButton>
          <IconButton label="Ocultar el panel" onClick={props.onHide}>
            <path d="M6 12h12" />
          </IconButton>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-0.5">
          <TabButton active={tab === 'codigo'} onClick={() => setTab('codigo')}>Codigo</TabButton>
          <TabButton active={tab === 'vista'} onClick={handleReproducir}>Vista previa</TabButton>
        </div>

        <button
          type="button"
          onClick={handleReproducir}
          disabled={!state.ready}
          aria-label={state.ready ? 'Reproducir la presentacion' : 'La presentacion aun no esta lista'}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-on-accent transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Reproducir
        </button>
      </div>

      {aviso && (
        <p role="status" className="shrink-0 border-b border-border px-3.5 py-2 text-[11px] text-secondary">
          {aviso}
        </p>
      )}

      {tab === 'vista' ? (
        <div className="min-h-0 flex-1 bg-surface-2">
          <PresentationPreview workspaceId={props.workspaceId} ready={state.ready} revision={revision} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-[38%] min-w-[150px] max-w-[240px] shrink-0 overflow-y-auto border-r border-border px-1.5">
            <PresentationFileTree
              files={state.files}
              selectedPath={state.selectedPath}
              writingPath={state.writingPath}
              errors={state.errors}
              loading={state.loading}
              onSelect={selectFile}
            />
          </div>
          <div className="min-w-0 flex-1">
            <PresentationCodeViewer
              path={state.selectedPath}
              content={state.selectedContent}
              imageUrl={state.selectedImageUrl}
              error={state.selectedPath ? state.errors[state.selectedPath] : undefined}
              onSave={editable ? (contenido) => saveFile(state.selectedPath as string, contenido) : undefined}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Abre la vista previa la PRIMERA vez que la presentacion queda lista y deja
 * de escribirse. Solo una vez: si el usuario vuelve al codigo para revisar
 * algo, una iteracion posterior no debe arrancarle la vista de las manos.
 */
function useAutoOpenPreview(input: { ready: boolean; writing: boolean; onOpen: () => void }) {
  const yaAbierta = useRef(false);
  const { ready, writing, onOpen } = input;

  useEffect(() => {
    if (yaAbierta.current || !ready || writing) return;
    yaAbierta.current = true;
    onOpen();
  }, [onOpen, ready, writing]);
}

/** Ancho ajustable con puntero y teclado, recordado entre sesiones. */
function usePanelWidth() {
  const [width, setWidth] = useState(leerAnchoGuardado);
  const [isResizing, setIsResizing] = useState(false);

  const aplicar = useCallback((valor: number) => {
    const acotado = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(valor)));
    setWidth(acotado);
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(acotado));
    } catch {
      // Sin almacenamiento el ancho no persiste; no es motivo para fallar.
    }
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    // El panel esta anclado a la derecha: el ancho es la distancia del puntero
    // al borde derecho de la ventana.
    aplicar(window.innerWidth - event.clientX);
  };

  const finalizar = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsResizing(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    aplicar(width + (event.key === 'ArrowLeft' ? 32 : -32));
  };

  return {
    width,
    isResizing,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finalizar,
      onPointerCancel: finalizar,
      onLostPointerCapture: () => setIsResizing(false),
      onKeyDown,
    },
  };
}

function leerAnchoGuardado(): number {
  try {
    const guardado = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
    if (Number.isFinite(guardado) && guardado >= MIN_WIDTH) return Math.min(guardado, MAX_WIDTH);
  } catch {
    // Sin almacenamiento se usa el ancho por defecto.
  }
  return DEFAULT_WIDTH;
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      className={`rounded-lg px-3 py-1 text-[11px] font-semibold transition ${
        props.active
          ? 'bg-card text-accent shadow-sm'
          : 'text-secondary hover:text-primary dark:hover:text-white'
      }`}
    >
      {props.children}
    </button>
  );
}

function IconButton(props: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className="grid h-7 w-7 place-items-center rounded-lg text-secondary transition hover:bg-white/[0.06] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {props.children}
      </svg>
    </button>
  );
}
