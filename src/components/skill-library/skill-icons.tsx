import type { JSX } from 'react';
import { resolveSkillIcon, type SkillIconId } from './skill-icons-catalog';

/**
 * Trazos de los iconos de Skills. Mismo estilo que el resto de la interfaz:
 * 24x24, trazo de 1.75 y extremos redondeados, heredando el color del tema.
 *
 * Los identificadores y etiquetas viven en `skill-icons-catalog.ts`.
 */
const PATHS: Record<SkillIconId, JSX.Element> = {
  presentacion: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M12 16v4M9 20h6M8 12l2.5-3 2 2.2L16 7.5" /></>,
  documento: <><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" /><path d="M14 3v4.5h4.5M9 13h6M9 16.5h4" /></>,
  grafica: <><path d="M4 20V4M4 20h16" /><rect x="7.5" y="12" width="3" height="5" rx="0.5" /><rect x="12.5" y="8" width="3" height="9" rx="0.5" /><rect x="17.5" y="14" width="2.5" height="3" rx="0.5" /></>,
  tabla: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15" /></>,
  correo: <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  calendario: <><rect x="3.5" y="5" width="17" height="15" rx="1.5" /><path d="M3.5 10h17M8 3.5V6.5M16 3.5V6.5" /></>,
  busqueda: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  codigo: <><path d="m9 8.5-4.5 3.5L9 15.5M15 8.5l4.5 3.5-4.5 3.5M13.5 5l-3 14" /></>,
  idea: <><path d="M12 3.5a6 6 0 0 0-3.5 10.9V16h7v-1.6A6 6 0 0 0 12 3.5z" /><path d="M10 19h4M10.5 21h3" /></>,
  objetivo: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.2" /></>,
  lista: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.75" cy="6.5" r="1.1" /><circle cx="4.75" cy="12" r="1.1" /><circle cx="4.75" cy="17.5" r="1.1" /></>,
  chat: <><path d="M20.5 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 20.5 12z" /><path d="M9 10.5h6M9 14h4" /></>,
  traducir: <><path d="M3.5 6h8M7.5 4v2M9.5 6a9 9 0 0 1-6 8.5M6 10.5a8 8 0 0 0 5 4.5" /><path d="m13 20 3.75-9 3.75 9M14.4 17h4.7" /></>,
  resumen: <><path d="M5 5.5h14M5 10h14M5 14.5h9M5 19h6" /></>,
  carpeta: <><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" /></>,
  equipo: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3.2 3.2 0 0 1 0 6.1M17.5 15a5.5 5.5 0 0 1 3 4.5" /></>,
  finanzas: <><path d="M4 20V4M4 20h16" /><path d="m7 15 3.5-4 3 2.5L20 7" /><path d="M16.5 7H20v3.5" /></>,
  proceso: <><rect x="3" y="4.5" width="6" height="5" rx="1" /><rect x="15" y="14.5" width="6" height="5" rx="1" /><path d="M6 9.5V15a2 2 0 0 0 2 2h7" /><path d="m13 15 2 2-2 2" /></>,
  etiqueta: <><path d="M11.5 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.5l-8.6 8.6a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1z" /><circle cx="16" cy="8" r="1.3" /></>,
  herramienta: <><path d="M14.5 6.5a3.5 3.5 0 0 0 4.6 4.6l-8 8a2.3 2.3 0 0 1-3.2-3.2z" /><path d="m6.5 6.5 2 2M4.5 10.5l2-2" /></>,
};

export function SkillIcon({
  icon,
  className = 'h-4 w-4',
}: {
  icon: string | null | undefined;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[resolveSkillIcon(icon)]}
    </svg>
  );
}
