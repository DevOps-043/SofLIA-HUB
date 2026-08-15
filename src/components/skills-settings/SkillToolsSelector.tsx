import { useCallback, useMemo, useState } from 'react';
import {
  SKILL_TOOL_GROUPS,
  SKILL_WEB_SEARCH_OPTIONS,
  type SkillToolGroup,
  type SkillWebSearch,
} from '../../shared/skills/tool-registry';
import { saveSkillTools, saveSkillWebSearch } from '../../services/skills/skill-channels-store';
import type { Skill } from '../../shared/skills/types';

/**
 * Selector de herramientas de una Skill.
 *
 * Qué hace exactamente, porque es fácil malinterpretarlo: **acota**. Sin
 * configurar nada, la Skill dispone de lo que su superficie ofrezca, igual que
 * antes de que esta pantalla existiera. Marcar herramientas reduce el catálogo
 * que se envía al modelo — lo que mejora su elección, abarata el turno y limita
 * lo que puede tocar. Nunca concede nada que la superficie no tuviera.
 */
export function SkillToolsSelector({
  skill,
  selection,
  webSearch,
  onChanged,
}: {
  skill: Skill;
  /** `null` = sin selección: la Skill usa todo lo de su superficie. */
  selection: readonly string[] | null;
  webSearch: SkillWebSearch;
  onChanged: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegidas = useMemo(() => new Set(selection ?? []), [selection]);
  const acotada = selection !== null;

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
    // La primera marca parte de "todas": si no, marcar una sola herramienta
    // pasaría de "todo" a "solo esa" de golpe, que no es lo que el usuario
    // espera al hacer clic en una casilla.
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

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        className="text-[11px] font-medium text-accent hover:underline"
      >
        {abierto ? 'Ocultar herramientas' : 'Configurar herramientas'}
        {acotada && <span className="ml-1 text-secondary">· {elegidas.size} seleccionadas</span>}
        {!acotada && <span className="ml-1 text-secondary">· todas</span>}
      </button>

      {abierto && (
        <div className="mt-2 rounded-xl border border-border bg-surface-2/60 p-3">
          <p className="text-[11px] text-secondary">
            Sin configurar, esta skill usa todas las herramientas que su canal ofrezca.
            Marcar herramientas la <strong>acota</strong>: nunca le concede nada que el canal no tuviera,
            y las operaciones que piden confirmación la siguen pidiendo.
          </p>

          {acotada && (
            <button
              type="button"
              onClick={() => void guardar(null)}
              disabled={guardando}
              className="mt-2 text-[11px] text-secondary hover:text-accent hover:underline disabled:opacity-50"
            >
              Quitar el límite y volver a usarlas todas
            </button>
          )}

          <div className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {SKILL_TOOL_GROUPS.map((group) => {
              const nombres = group.tools.map((tool) => tool.name);
              const activas = nombres.filter((name) => !acotada || elegidas.has(name)).length;
              return (
                <section key={group.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{group.label}</p>
                      <p className="text-[11px] text-secondary">{group.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => alternarGrupo(group)}
                      disabled={guardando}
                      className="shrink-0 text-[11px] text-accent hover:underline disabled:opacity-50"
                    >
                      {activas === nombres.length ? 'Ninguna' : 'Todas'}
                    </button>
                  </div>

                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {group.tools.map((tool) => {
                      const marcada = !acotada || elegidas.has(tool.name);
                      return (
                        <label
                          key={tool.name}
                          title={tool.description}
                          className="flex items-start gap-1.5 rounded-lg px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={guardando}
                            onChange={() => alternarHerramienta(tool.name)}
                            className="mt-0.5 accent-[var(--accent,#c96442)]"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] text-gray-800 dark:text-gray-200">
                              {tool.label}
                              {tool.irreversible && (
                                <span title="Su efecto no se deshace desde el chat" className="ml-1 text-warning">•</span>
                              )}
                            </span>
                            {tool.channelOnly && (
                              <span className="block text-[10px] text-secondary">Solo por WhatsApp o Telegram</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">Búsqueda web</p>
            <p className="text-[11px] text-secondary">
              No es una herramienta más: el proveedor no permite combinarla con las demás en la
              misma petición, así que SofLIA resuelve primero la búsqueda y después la acción.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {SKILL_WEB_SEARCH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void cambiarBusqueda(option.value)}
                  disabled={guardando}
                  title={option.description}
                  aria-pressed={webSearch === option.value}
                  className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                    webSearch === option.value
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-border bg-card text-secondary hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
