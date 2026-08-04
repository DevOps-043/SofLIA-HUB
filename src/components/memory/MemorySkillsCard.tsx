import { useCallback, useEffect, useState } from 'react';
import { deleteUserSkill, listUserSkills, type LearnedSkill } from '../../services/memory-bridge';

const TYPE_LABELS: Record<string, string> = {
  preferencia: 'Preferencia',
  correccion: 'Corrección',
  contexto_trabajo: 'Contexto de trabajo',
  procedimiento: 'Procedimiento',
};

/**
 * Tarjeta de gestión de lo que SofLIA ha APRENDIDO del usuario. Muestra las
 * skills (preferencias, correcciones, contexto, procedimientos) que el sistema
 * infirió por su cuenta y permite borrarlas — el usuario controla su memoria.
 */
export function MemorySkillsCard({ userId }: { userId: string }) {
  const [skills, setSkills] = useState<LearnedSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSkills(await listUserSkills(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleDelete = useCallback(async (id: number) => {
    if (await deleteUserSkill(id)) setSkills((prev) => prev.filter((skill) => skill.id !== id));
  }, []);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-primary">Lo que he aprendido de ti</h3>
        <p className="mt-1 text-sm text-secondary">
          SofLIA aprende tus preferencias, correcciones y forma de trabajar de todas tus conversaciones y tareas, y lo aplica automáticamente. Puedes borrar lo que no quieras que recuerde.
        </p>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-secondary">Cargando…</p>
      ) : skills.length === 0 ? (
        <p className="py-6 text-center text-sm text-secondary">
          Aún no he aprendido nada específico. A medida que trabajemos juntos, iré recordando cómo te gustan las cosas.
        </p>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill) => (
            <li key={skill.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                    {TYPE_LABELS[skill.type] ?? skill.type}
                  </span>
                  <span className="truncate text-sm font-medium text-primary">{skill.title}</span>
                </div>
                <p className="mt-1 text-sm text-secondary">{skill.content}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(skill.id)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500"
                aria-label={`Olvidar: ${skill.title}`}
              >
                Olvidar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
