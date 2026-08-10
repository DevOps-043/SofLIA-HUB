/**
 * Iconos por tipo de archivo del workspace.
 *
 * Se dibujan a mano en el mismo estilo del resto de la interfaz en vez de
 * anadir un paquete de iconos: son cinco glifos y una libreria traeria cientos
 * con otro grosor de trazo y otra rejilla, que se notaria al lado de los demas
 * iconos de la aplicacion.
 */

type FileKind = 'html' | 'css' | 'markdown' | 'imagen' | 'archivo';

function classify(filePath: string): FileKind {
  const extension = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'html' || extension === 'htm') return 'html';
  if (extension === 'css') return 'css';
  if (extension === 'md') return 'markdown';
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(extension)) return 'imagen';
  return 'archivo';
}

/** Cada tipo tiene su color para distinguirlos de un vistazo en la lista. */
const COLOR: Record<FileKind, string> = {
  html: 'text-orange-400',
  css: 'text-sky-400',
  markdown: 'text-emerald-400',
  imagen: 'text-violet-400',
  archivo: 'text-secondary',
};

const PATHS: Record<FileKind, React.ReactNode> = {
  html: <><path d="m9 8.5-3 3.5 3 3.5M15 8.5l3 3.5-3 3.5" /></>,
  css: <><path d="M6 4h12l-1 14-5 2-5-2z" /><path d="M9 8h6l-.4 5-2.6 1-2.6-1" /></>,
  markdown: <><rect x="3" y="6" width="18" height="12" rx="1.5" /><path d="M6.5 15V9l2.5 3 2.5-3v6M16 9v6M16 15l-1.5-2M16 15l1.5-2" /></>,
  imagen: <><rect x="3" y="5" width="18" height="14" rx="1.5" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 4.5-4.5L12 16l3-2.5L20 18" /></>,
  archivo: <><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" /><path d="M14 3v4.5h4.5" /></>,
};

export function FileTypeIcon({ path, className = 'h-4 w-4' }: { path: string; className?: string }) {
  const kind = classify(path);
  return (
    <svg
      className={`${className} ${COLOR[kind]}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[kind]}
    </svg>
  );
}

/** Carpeta para los grupos del arbol de archivos. */
export function FolderIcon({ open, className = 'h-4 w-4' }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className} text-secondary`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open
        ? <path d="M3.5 8.5V6.5A1.5 1.5 0 0 1 5 5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v.5M3 19l1.9-7.1A1.5 1.5 0 0 1 6.3 11h14.2a1 1 0 0 1 1 1.3L19.6 19z" />
        : <path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z" />}
    </svg>
  );
}
