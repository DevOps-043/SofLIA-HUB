import { useCallback, useMemo, useState, type JSX } from 'react';
import {
  SKILL_TOOL_GROUPS,
  SKILL_TOOL_ENTRIES,
  SKILL_WEB_SEARCH_OPTIONS,
  type SkillToolGroup,
  type SkillToolGroupId,
  type SkillWebSearch,
} from '../../shared/skills/tool-registry';
import { saveSkillTools, saveSkillWebSearch } from '../../services/skills/skill-channels-store';
import type { Skill } from '../../shared/skills/types';

/** Iconos vectoriales de trazo fino (1.75px) para cada categoría de herramientas. */
const GROUP_ICONS: Record<SkillToolGroupId, JSX.Element> = {
  correo: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  calendario: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  drive: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M12 12v9M8 17l4 4 4-4" />
    </svg>
  ),
  chat: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 10h8M8 14h4" />
    </svg>
  ),
  navegador: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  computadora: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  archivos: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  ),
  procesos: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" x2="20" y1="19" y2="19" />
    </svg>
  ),
  proyectos: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),
  imagenes: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  'espacio-trabajo': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.9a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 12.5-8.58 3.9a2 2 0 0 1-1.66 0L2.6 12.5" />
      <path d="m22 17.5-8.58 3.9a2 2 0 0 1-1.66 0L2.6 17.5" />
    </svg>
  ),
};

/**
 * Selector y gestor de permisos de herramientas para una Skill.
 *
 * Aplica la doctrina visual y funcional del Sistema de Diseño SOFIA:
 * - Botón disparador con indicador de estado claro.
 * - Callout informativo refinado sobre cómo acotar herramientas.
 * - Filtrado en tiempo real por término de búsqueda.
 * - Checkboxes personalizados con microinteracciones y feedback de color.
 * - Categorización por dominios con iconos y selector rápido todas/ninguna.
 * - Etiquetas de aviso para acciones irreversibles y canales específicos.
 * - Selector segmentado para la búsqueda web en tiempo real.
 */
export function SkillToolsSelector({
  skill,
  selection,
  webSearch,
  onChanged,
}: {
  skill: Skill;
  /** `null` = sin selección: la Skill usa todo lo que ofrezca su superficie. */
  selection: readonly string[] | null;
  webSearch: SkillWebSearch;
  onChanged: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const totalHerramientas = SKILL_TOOL_ENTRIES.length;
  const elegidas = useMemo(() => new Set(selection ?? []), [selection]);
  const acotada = selection !== null;
  const activasCount = acotada ? elegidas.size : totalHerramientas;

  const guardar = useCallback(async (siguiente: readonly string[] | null) => {
    setGuardando(true);
    setError(null);
    try {
      await saveSkillTools(skill.id, siguiente);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las herramientas.');
    } finally {
      setGuardando(false);
    }
  }, [onChanged, skill.id]);

  const alternarHerramienta = useCallback((name: string) => {
    const base = selection ?? SKILL_TOOL_GROUPS.flatMap((group) => group.tools.map((tool) => tool.name));
    const siguiente = base.includes(name) ? base.filter((valor) => valor !== name) : [...base, name];
    void guardar(siguiente);
  }, [guardar, selection]);

  const alternarGrupo = useCallback((group: SkillToolGroup) => {
    const base = selection ?? SKILL_TOOL_GROUPS.flatMap((entry) => entry.tools.map((tool) => tool.name));
    const nombres = group.tools.map((tool) => tool.name);
    const todasDentro = nombres.every((name) => base.includes(name));
    const siguiente = todasDentro
      ? base.filter((valor) => !nombres.includes(valor))
      : [...new Set([...base, ...nombres])];
    void guardar(siguiente);
  }, [guardar, selection]);

  const cambiarBusqueda = useCallback(async (valor: SkillWebSearch) => {
    setGuardando(true);
    setError(null);
    try {
      await saveSkillWebSearch(skill.id, valor);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la búsqueda web.');
    } finally {
      setGuardando(false);
    }
  }, [onChanged, skill.id]);

  // Filtrado de grupos y herramientas por texto de búsqueda
  const gruposFiltrados = useMemo(() => {
    const query = busqueda.trim().toLowerCase();
    if (!query) return SKILL_TOOL_GROUPS;

    return SKILL_TOOL_GROUPS.map((group) => {
      const groupMatch = group.label.toLowerCase().includes(query) || group.description.toLowerCase().includes(query);
      const toolsMatch = group.tools.filter(
        (tool) =>
          tool.label.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.name.toLowerCase().includes(query),
      );

      if (groupMatch) return group;
      if (toolsMatch.length > 0) return { ...group, tools: toolsMatch };
      return null;
    }).filter((g): g is SkillToolGroup => g !== null);
  }, [busqueda]);

  const totalHerramientasVisibles = useMemo(() => {
    return gruposFiltrados.reduce((acc, g) => acc + g.tools.length, 0);
  }, [gruposFiltrados]);

  return (
    <div className="mt-2.5">
      {/* Botón Disparador Principal — estilo SOFIA Design System */}
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        aria-expanded={abierto}
        className={`group flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-all duration-150 ${
          abierto
            ? 'border-accent/40 bg-surface-2/80 dark:bg-card/90 shadow-xs'
            : 'border-border/80 bg-surface-2/40 hover:border-accent/30 hover:bg-surface-2/70 dark:bg-card/40 dark:hover:bg-card/70'
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg transition-colors ${
              abierto ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-secondary group-hover:text-accent'
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </span>
          <span className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
            Herramientas y permisos
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {acotada ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              {activasCount} de {totalHerramientas} acotadas
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/80 dark:bg-surface-2/80 px-2 py-0.5 text-[10px] font-medium text-secondary">
              Todas habilitadas ({totalHerramientas})
            </span>
          )}

          <svg
            className={`h-4 w-4 text-secondary transition-transform duration-200 ${
              abierto ? 'rotate-180 text-accent' : 'group-hover:text-gray-800 dark:group-hover:text-gray-200'
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Contenedor Desplegable */}
      {abierto && (
        <div className="mt-2.5 rounded-2xl border border-border/90 bg-card/95 dark:bg-card/70 p-3.5 sm:p-4 shadow-sm backdrop-blur-md transition-all animate-fade-in space-y-4">
          {/* Banner Informativo SofLIA */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/[0.04] p-3 text-left">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="font-['IBM_Plex_Sans'] text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Regla de confinamiento
                </p>
                <p className="text-[11px] leading-relaxed text-secondary mt-0.5">
                  Sin configurar, la skill usa todas las herramientas de su canal. Marcar opciones la <strong>acota</strong> para
                  reducir tokens y mejorar la precisión sin alterar confirmaciones de seguridad.
                </p>
              </div>
            </div>

            {acotada && (
              <button
                type="button"
                onClick={() => void guardar(null)}
                disabled={guardando}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/80 bg-card dark:bg-surface-2 px-2.5 py-1.5 text-[11px] font-medium text-secondary hover:border-accent/40 hover:text-accent hover:bg-accent/5 transition-all disabled:opacity-50"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                Restablecer a todas
              </button>
            )}
          </div>

          {/* Barra de Búsqueda Rápida de Herramientas */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-secondary">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={`Filtrar herramientas (ej. gmail, archivos, capturar...) — ${totalHerramientasVisibles} disponibles`}
              className="w-full rounded-xl border border-border/80 bg-surface-2/60 dark:bg-surface-2/40 py-1.5 pl-8 pr-8 text-xs text-gray-900 dark:text-white placeholder:text-secondary focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 transition-all"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-secondary hover:text-gray-900 dark:hover:text-white"
                title="Limpiar búsqueda"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Listado de Grupos de Herramientas */}
          <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
            {gruposFiltrados.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs font-medium text-secondary">
                  No se encontraron herramientas con &ldquo;{busqueda}&rdquo;.
                </p>
                <button
                  type="button"
                  onClick={() => setBusqueda('')}
                  className="mt-1.5 text-xs text-accent hover:underline font-medium"
                >
                  Limpiar filtro
                </button>
              </div>
            ) : (
              gruposFiltrados.map((group) => {
                const nombres = group.tools.map((tool) => tool.name);
                const activas = nombres.filter((name) => !acotada || elegidas.has(name)).length;
                const todasActivas = activas === nombres.length;

                return (
                  <section
                    key={group.id}
                    className="rounded-xl border border-border/70 bg-surface-2/30 dark:bg-surface-2/20 p-3 transition-colors"
                  >
                    {/* Encabezado del Grupo */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-card dark:bg-card/80 border border-border/70 text-accent">
                          {GROUP_ICONS[group.id] ?? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                              <path d="M12 2v20M2 12h20" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {group.label}
                            </h4>
                            <span className="font-['IBM_Plex_Sans'] text-[10px] text-secondary font-medium">
                              ({activas}/{nombres.length})
                            </span>
                          </div>
                          <p className="text-[11px] text-secondary truncate mt-0.5">
                            {group.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => alternarGrupo(group)}
                        disabled={guardando}
                        className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md text-[11px] font-medium text-accent hover:bg-accent/10 hover:underline transition-colors disabled:opacity-50"
                      >
                        {todasActivas ? 'Desmarcar todas' : 'Marcar todas'}
                      </button>
                    </div>

                    {/* Grilla de Herramientas */}
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.tools.map((tool) => {
                        const marcada = !acotada || elegidas.has(tool.name);

                        return (
                          <div
                            key={tool.name}
                            onClick={() => !guardando && alternarHerramienta(tool.name)}
                            role="checkbox"
                            aria-checked={marcada}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === ' ' || e.key === 'Enter') {
                                e.preventDefault();
                                if (!guardando) alternarHerramienta(tool.name);
                              }
                            }}
                            title={tool.description}
                            className={`group relative flex items-start gap-2.5 p-2 rounded-lg border transition-all duration-150 cursor-pointer select-none ${
                              marcada
                                ? 'border-accent/30 bg-accent/[0.04] dark:border-accent/30 dark:bg-accent/[0.06]'
                                : 'border-border/40 bg-card/60 dark:bg-card/40 hover:border-border/90 hover:bg-card dark:hover:bg-card/80 opacity-70 hover:opacity-100'
                            }`}
                          >
                            {/* Checkbox personalizado accesible */}
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all duration-150 ${
                                marcada
                                  ? 'bg-accent border-accent text-on-accent shadow-xs'
                                  : 'border-border/90 bg-card dark:bg-surface-2 group-hover:border-accent/60'
                              }`}
                            >
                              {marcada && (
                                <svg
                                  className="h-2.5 w-2.5 stroke-current stroke-[3]"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                            </span>

                            {/* Contenido de la Herramienta */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-medium truncate ${
                                  marcada ? 'text-gray-900 dark:text-gray-100' : 'text-secondary group-hover:text-gray-800 dark:group-hover:text-gray-200'
                                }`}>
                                  {tool.label}
                                </span>

                                {tool.irreversible && (
                                  <span
                                    title="Su efecto no se deshace desde el chat"
                                    className="inline-flex items-center gap-0.5 rounded border border-warning/30 bg-warning/10 px-1 py-0.2 text-[9px] font-semibold text-warning"
                                  >
                                    Irreversible
                                  </span>
                                )}

                                {tool.channelOnly && (
                                  <span className="inline-flex items-center rounded border border-border/60 bg-surface-2 px-1 py-0.2 text-[9px] text-secondary">
                                    WhatsApp / TG
                                  </span>
                                )}
                              </div>
                              <p className="text-[10.5px] leading-tight text-secondary line-clamp-1 mt-0.5">
                                {tool.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          {/* Sección de Búsqueda Web — Segmented Control SofLIA */}
          <div className="rounded-xl border border-border/70 bg-surface-2/30 dark:bg-surface-2/20 p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-card dark:bg-card/80 border border-border/70 text-accent">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" x2="22" y1="12" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  Búsqueda web en tiempo real
                </h4>
                <p className="text-[11px] text-secondary">
                  Grounding con Google Search. SofLIA resuelve primero la búsqueda y luego ejecuta la acción.
                </p>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {SKILL_WEB_SEARCH_OPTIONS.map((option) => {
                const activo = webSearch === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void cambiarBusqueda(option.value)}
                    disabled={guardando}
                    aria-pressed={activo}
                    className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all duration-150 disabled:opacity-50 ${
                      activo
                        ? 'border-accent bg-accent/10 text-accent ring-1 ring-accent/30 shadow-xs'
                        : 'border-border/70 bg-card/80 dark:bg-surface-2/60 text-secondary hover:border-accent/30 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-semibold">
                        {option.label}
                      </span>
                      {activo && (
                        <svg className="h-3 w-3 text-accent stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </div>
                    <span className="text-[10px] leading-tight text-secondary mt-0.5 line-clamp-2">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feedback de Estado / Guardado / Error */}
          {guardando && (
            <div className="flex items-center gap-2 text-xs text-secondary animate-pulse">
              <svg className="h-3.5 w-3.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
              </svg>
              <span>Guardando cambios en herramientas...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.08] px-3 py-2 text-xs text-danger">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <span className="flex-1">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
