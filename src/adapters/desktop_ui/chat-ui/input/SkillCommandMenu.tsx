import { isSystemSkill } from '../../../../shared/skills/types';
import { SkillIcon } from '../../../../components/skill-library/skill-icons';
import type { SkillCommand } from '../../../../services/skills/slash-commands';

/**
 * Menu de comandos de Skills sobre el compositor.
 *
 * Aparece al escribir `/` y desaparece en cuanto el texto deja de ser un
 * comando.
 *
 * Va en FLUJO NORMAL, no posicionado en absoluto: el compositor y el chat
 * tienen `overflow-hidden`, asi que un menu absoluto que sobresale por arriba
 * queda recortado. Un portal tampoco sirve, porque en el chat flotante del
 * navegador quedaria por debajo de la vista nativa. Al ocupar espacio real,
 * el compositor crece hacia arriba —igual que con los adjuntos— y nada lo
 * recorta.
 */
export function SkillCommandMenu(props: {
  matches: SkillCommand[];
  highlighted: number;
  onSelect: (entry: SkillCommand) => void;
  onHighlight: (index: number) => void;
}) {
  if (props.matches.length === 0) return null;

  return (
    <div
      role="listbox"
      aria-label="Skills disponibles"
      className="mb-1.5 max-h-64 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg shadow-black/10"
    >
      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">
        Skills
      </p>
      {props.matches.map((entry, index) => (
        <button
          key={entry.skill.id}
          type="button"
          role="option"
          aria-selected={index === props.highlighted}
          onMouseEnter={() => props.onHighlight(index)}
          // `onMouseDown` y no `onClick`: el clic no debe quitarle el foco al
          // compositor antes de que se aplique la seleccion.
          onMouseDown={(event) => {
            event.preventDefault();
            props.onSelect(entry);
          }}
          className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
            index === props.highlighted
              ? 'bg-accent/[0.12] text-accent'
              : 'text-primary hover:bg-gray-100 dark:text-white/85 dark:hover:bg-white/[0.05]'
          }`}
        >
          <SkillIcon icon={entry.skill.icon} className="h-[18px] w-[18px] shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold">
              /{entry.command}
              {isSystemSkill(entry.skill) && (
                <span className="ml-1.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-accent">
                  Sistema
                </span>
              )}
            </span>
            {entry.skill.description && (
              <span className="block truncate text-[10px] text-secondary">{entry.skill.description}</span>
            )}
          </span>
        </button>
      ))}
      <p className="px-2 pb-0.5 pt-1 text-[9px] text-secondary">
        Enter activa · Esc cierra
      </p>
    </div>
  );
}
