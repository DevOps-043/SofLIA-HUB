import { SkillIcon } from '../skill-library/skill-icons';
import { SKILL_ICONS, type SkillIconId } from '../skill-library/skill-icons-catalog';

/**
 * Selector de icono. Catalogo cerrado a proposito: cualquier icono elegido
 * aqui se ve igual en todos los equipos y hereda el color del tema, cosa que
 * un emoji no garantiza.
 */
export function SkillIconPicker(props: {
  value: string;
  onChange: (icon: SkillIconId) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-secondary">Icono</span>
      <div role="radiogroup" aria-label="Icono de la skill" className="flex flex-wrap gap-1.5">
        {SKILL_ICONS.map((entry) => {
          const selected = entry.id === props.value;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={entry.label}
              title={entry.label}
              onClick={() => props.onChange(entry.id)}
              className={`grid h-9 w-9 place-items-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
                selected
                  ? 'border-accent bg-accent/[0.12] text-accent'
                  : 'border-border bg-surface-2 text-secondary hover:border-accent/40 hover:text-primary dark:hover:text-white'
              }`}
            >
              <SkillIcon icon={entry.id} className="h-[18px] w-[18px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
