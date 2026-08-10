import { useEffect, useState } from 'react';
import { deleteUserSkill, resolveSkillCatalog, type SkillCatalog } from '../services/skills-service';
import { isUserSkill, type Skill } from '../shared/skills/types';
import { SkillLibraryItem } from './skill-library/SkillLibraryItem';
import {
  SkillLibraryEmpty,
  SkillLibraryError,
  SkillLibraryLoading,
} from './skill-library/SkillLibraryStates';
import type { SkillLibraryProps } from './skill-library/types';

/**
 * Biblioteca de Skills. Separa visualmente las del sistema (declaradas en
 * codigo, no editables) de las del usuario, porque la diferencia importa:
 * solo las del sistema pueden traer herramientas.
 */
export function SkillLibrary({ isOpen, onClose, onUseSkill, onEditSkill }: SkillLibraryProps) {
  const [catalog, setCatalog] = useState<SkillCatalog>({ system: [], user: [], all: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // El catalogo se carga al abrir la biblioteca. La peticion vive en el
  // cuerpo del efecto y el estado se actualiza en su callback, no de forma
  // sincrona: abrir el modal no debe encadenar renders.
  useEffect(() => {
    if (!isOpen) return undefined;

    // No se reactiva el spinner al reabrir: el catalogo ya cargado se muestra
    // de inmediato y se actualiza cuando llega el nuevo, sin parpadeo.
    let cancelled = false;
    void resolveSkillCatalog('chat')
      .then((resolved) => {
        if (cancelled) return;
        setCatalog(resolved);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las skills.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleDelete = async (id: string) => {
    const skill = catalog.all.find((entry) => entry.id === id);
    if (!skill || !isUserSkill(skill)) {
      setAviso('Las skills del sistema se actualizan con el producto y no pueden eliminarse.');
      return;
    }
    try {
      await deleteUserSkill(id);
      setCatalog((current) => ({
        ...current,
        user: current.user.filter((entry) => entry.id !== id),
        all: current.all.filter((entry) => entry.id !== id),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la skill.');
    }
  };

  const handleEdit = (skill: Skill) => {
    if (!isUserSkill(skill)) {
      setAviso('Las skills del sistema se actualizan con el producto y no pueden editarse.');
      return;
    }
    onEditSkill(skill);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-[90%] max-w-[550px] flex-col rounded-2xl border border-white/10 bg-[#1a1f2e] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Skills"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Skills</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-xl text-gray-400 transition-colors hover:text-white">
            x
          </button>
        </div>

        {aviso && (
          <p role="status" className="border-b border-white/10 px-6 py-2 text-xs text-gray-300">
            {aviso}
          </p>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading && <SkillLibraryLoading />}
          {error && <SkillLibraryError error={error} />}

          {!loading && !error && (
            <>
              {catalog.system.length > 0 && (
                <section>
                  <h3 className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Skills del sistema
                  </h3>
                  <div className="space-y-2">
                    {catalog.system.map((skill) => (
                      <SkillLibraryItem
                        key={skill.id}
                        skill={skill}
                        onUse={onUseSkill}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h3 className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Mis skills
                </h3>
                {catalog.user.length === 0 ? (
                  <SkillLibraryEmpty />
                ) : (
                  <div className="space-y-2">
                    {catalog.user.map((skill) => (
                      <SkillLibraryItem
                        key={skill.id}
                        skill={skill}
                        onUse={onUseSkill}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SkillLibrary;
