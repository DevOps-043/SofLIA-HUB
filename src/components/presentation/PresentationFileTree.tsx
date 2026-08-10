import { useMemo, useState } from 'react';
import type { WorkspaceFile } from '../../services/skills/workspace-bridge';
import { FileTypeIcon, FolderIcon } from './FileTypeIcon';

/**
 * Arbol de archivos del workspace, agrupado por carpeta.
 *
 * Una lista plana de rutas completas obliga a leer `estilos/` en cada linea y
 * se trunca en un panel estrecho. Agrupar deja el nombre del archivo visible
 * aunque el panel sea angosto.
 */
export function PresentationFileTree(props: {
  files: WorkspaceFile[];
  selectedPath: string | null;
  writingPath: string | null;
  errors: Record<string, string>;
  loading: boolean;
  onSelect: (path: string) => void;
}) {
  const grupos = useMemo(() => agruparPorCarpeta(props.files), [props.files]);
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const alternar = (carpeta: string) => {
    setColapsadas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(carpeta)) siguiente.delete(carpeta);
      else siguiente.add(carpeta);
      return siguiente;
    });
  };

  if (props.files.length === 0) {
    return (
      <p className="px-3 py-4 text-[11px] text-secondary">
        {props.loading ? 'Cargando...' : 'Aun no hay archivos.'}
      </p>
    );
  }

  return (
    <nav className="py-1.5" aria-label="Archivos de la presentacion">
      {grupos.map(([carpeta, archivos]) => (
        <div key={carpeta || '.'} className="mb-0.5">
          {carpeta && (
            <button
              type="button"
              onClick={() => alternar(carpeta)}
              aria-expanded={!colapsadas.has(carpeta)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[11px] font-medium text-secondary transition hover:bg-white/[0.04]"
            >
              <FolderIcon open={!colapsadas.has(carpeta)} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{carpeta}</span>
            </button>
          )}

          {!colapsadas.has(carpeta) && archivos.map((archivo) => {
            const seleccionado = props.selectedPath === archivo.path;
            const escribiendo = props.writingPath === archivo.path;
            const error = props.errors[archivo.path];

            return (
              <button
                key={archivo.path}
                type="button"
                onClick={() => props.onSelect(archivo.path)}
                aria-current={seleccionado}
                title={archivo.path}
                className={`group flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left transition ${
                  carpeta ? 'pl-6' : 'pl-2'
                } ${
                  seleccionado
                    ? 'bg-accent/[0.14] text-accent'
                    : 'text-primary hover:bg-white/[0.05] dark:text-white/80'
                }`}
              >
                <FileTypeIcon path={archivo.path} className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[11.5px]">{nombre(archivo.path)}</span>

                {escribiendo && (
                  <span
                    aria-label="Escribiendo"
                    className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent"
                  />
                )}
                {!escribiendo && error && (
                  <span aria-label="Error" className="shrink-0 text-[10px] font-bold text-danger">!</span>
                )}
                {!escribiendo && !error && (
                  <span className="shrink-0 text-[9px] tabular-nums text-secondary opacity-0 transition group-hover:opacity-100">
                    {formatearTamano(archivo.bytes)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Carpeta raiz primero (cadena vacia), despues el resto en orden alfabetico. */
function agruparPorCarpeta(files: WorkspaceFile[]): [string, WorkspaceFile[]][] {
  const grupos = new Map<string, WorkspaceFile[]>();

  for (const file of files) {
    const corte = file.path.lastIndexOf('/');
    const carpeta = corte === -1 ? '' : file.path.slice(0, corte);
    const actual = grupos.get(carpeta);
    if (actual) actual.push(file);
    else grupos.set(carpeta, [file]);
  }

  return [...grupos.entries()].sort(([izquierda], [derecha]) => {
    if (izquierda === '') return -1;
    if (derecha === '') return 1;
    return izquierda.localeCompare(derecha);
  });
}

function nombre(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

function formatearTamano(bytes: number): string {
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
