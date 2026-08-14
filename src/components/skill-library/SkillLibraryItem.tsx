import { isUserSkill } from '../../shared/skills/types';
import { SkillIcon } from './skill-icons';
import type { SkillLibraryItemProps } from './types';

/**
 * Entrada de la biblioteca. Las Skills del sistema no ofrecen editar ni
 * eliminar: se actualizan con el producto, y permitir tocarlas dejaria al
 * usuario con una version divergente de una capacidad con herramientas.
 */
export function SkillLibraryItem({ skill, onUse, onEdit, onDelete }: SkillLibraryItemProps) {
  const editable = isUserSkill(skill);

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border/80 bg-surface-2/60 p-3 transition-colors hover:bg-surface-2 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/[0.08]">
      <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-card border border-border/60 text-accent shadow-xs dark:border-transparent dark:bg-white/[0.06]">
        <SkillIcon icon={skill.icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900 dark:text-white">{skill.name}</span>
          {!editable && (
            <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
              Sistema
            </span>
          )}
        </div>
        {skill.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-secondary">{skill.description}</div>
        )}
        {skill.category && (
          <span className="mt-1.5 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
            {skill.category}
          </span>
        )}
      </div>
      <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onUse(skill)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent transition-colors hover:opacity-90"
        >
          Usar
        </button>
        {editable && (
          <>
            <button
              type="button"
              onClick={() => onEdit(skill)}
              className="rounded-lg px-2 py-1.5 text-xs text-secondary transition-colors hover:bg-black/5 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Editar
            </button>
            <button
              type="button"
              aria-label={`Eliminar ${skill.name}`}
              onClick={() => onDelete(skill.id)}
              className="rounded-lg px-2 py-1.5 text-xs text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500"
            >
              x
            </button>
          </>
        )}
      </div>
    </div>
  );
}
