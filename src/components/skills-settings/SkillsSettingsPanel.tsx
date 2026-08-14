import { useCallback, useEffect, useState } from 'react';
import {
  createUserSkill,
  deleteUserSkill,
  resolveSkillCatalog,
  updateUserSkill,
  type SkillCatalog,
} from '../../services/skills-service';
import { buildSkillCommands } from '../../services/skills/slash-commands';
import type { CreateUserSkillInput, UserSkill } from '../../shared/skills/types';
import { Button, SectionHeader } from '../ui';
import { SkillIcon } from '../skill-library/skill-icons';
import { SkillEditorForm } from './SkillEditorForm';
import { SkillChannelsSelector } from './SkillChannelsSelector';
import { PassiveSkillsSection } from './PassiveSkillsSection';
import { resolveChannelsForSkill } from '../../shared/skills/channels';

/**
 * Configuracion de Skills.
 *
 * Muestra las del sistema como referencia —para que el usuario vea con qué
 * comando se invocan y no elija uno que choque— y permite crear, editar y
 * eliminar las suyas.
 */
export function SkillsSettingsPanel() {
  const [catalog, setCatalog] = useState<SkillCatalog>({ system: [], user: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserSkill | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    void resolveSkillCatalog('chat', { includeInactive: true })
      .then((resolved) => {
        if (!cancelled) {
          setCatalog(resolved);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las skills.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const commands = buildSkillCommands(catalog);
  const editorOpen = creating || editing !== null;

  // Comandos ocupados por OTRAS skills: la que se edita no choca consigo misma.
  const takenCommands = commands
    .filter((entry) => entry.skill.id !== editing?.id)
    .map((entry) => entry.command);

  const closeEditor = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSubmit = async (input: CreateUserSkillInput) => {
    if (editing) await updateUserSkill(editing.id, input);
    else await createUserSkill(input);
    closeEditor();
    reload();
  };

  const handleDelete = async (skill: UserSkill) => {
    try {
      await deleteUserSkill(skill.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la skill.');
    }
  };

  const commandOf = (skillId: string) => commands.find((entry) => entry.skill.id === skillId)?.command ?? '';

  return (
    <div className="h-full overflow-y-auto p-6">
      <SectionHeader
        title="Skills"
        subtitle="Capacidades que puedes invocar escribiendo / y su nombre, y las que se ejecutan solas. Elige en qué canales quieres cada una."
      />

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {editorOpen ? (
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            {editing ? `Editar ${editing.name}` : 'Nueva skill'}
          </h3>
          <SkillEditorForm
            key={editing?.id ?? 'nueva'}
            skill={editing}
            takenCommands={takenCommands}
            onSubmit={handleSubmit}
            onCancel={closeEditor}
          />
        </div>
      ) : (
        <>
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Mis skills</h3>
              <Button size="sm" onClick={() => setCreating(true)}>Nueva skill</Button>
            </div>

            {loading && <p className="py-6 text-center text-sm text-secondary">Cargando...</p>}

            {!loading && catalog.user.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-secondary">
                Todavia no has creado ninguna skill. Una skill guarda instrucciones que puedes reutilizar escribiendo su comando en el chat.
              </p>
            )}

            <div className="space-y-2">
              {catalog.user.map((skill) => (
                <article
                  key={skill.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
                    <SkillIcon icon={skill.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{skill.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-accent">/{commandOf(skill.id)}</p>
                    {skill.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-secondary">{skill.description}</p>
                    )}
                    <SkillChannelsSelector
                      skill={skill}
                      active={resolveChannelsForSkill(skill, catalog.channels)}
                      onChanged={reload}
                    />
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(skill)}>Editar</Button>
                    <Button size="sm" variant="danger" onClick={() => void handleDelete(skill)}>Eliminar</Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Skills del sistema</h3>
            <p className="mb-2 text-xs text-secondary">
              Vienen con el producto y se actualizan con el. No se editan, pero puedes ver su comando para no repetirlo.
            </p>
            <div className="space-y-2">
              {catalog.system.map((skill) => (
                <article
                  key={skill.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-surface-2/60 p-3.5"
                >
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-accent">
                    <SkillIcon icon={skill.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{skill.name}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-accent">/{commandOf(skill.id)}</p>
                    {skill.description && (
                      <p className="mt-1 text-xs text-secondary">{skill.description}</p>
                    )}
                    <SkillChannelsSelector
                      skill={skill}
                      active={resolveChannelsForSkill(skill, catalog.channels)}
                      onChanged={reload}
                    />
                  </div>
                </article>
              ))}
              {!loading && catalog.system.length === 0 && (
                <p className="text-xs text-secondary">No hay skills del sistema habilitadas.</p>
              )}
            </div>
          </section>

          <PassiveSkillsSection />
        </>
      )}
    </div>
  );
}
