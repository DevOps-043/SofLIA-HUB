import type { ChatUIController } from '../useChatUIController';

/**
 * Sugerencias de la Skill recien activada.
 *
 * Aparecen solo mientras el compositor esta vacio: en cuanto el usuario
 * escribe, deja de ser una pantalla en blanco y las sugerencias estorban.
 * Pulsar una la coloca en el compositor sin enviarla, para que pueda
 * ajustarla antes.
 */
export function StarterPrompts({ controller }: { controller: ChatUIController }) {
  const skill = controller.state.skillModals.activeSkill?.skill ?? null;
  const prompts = skill?.starterPrompts ?? [];

  if (!skill || prompts.length === 0) return null;
  if (controller.state.input.value.trim().length > 0) return null;

  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5" aria-label={`Sugerencias de ${skill.name}`}>
      {prompts.slice(0, 4).map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => controller.state.input.set(prompt)}
          className="max-w-full truncate rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[11px] text-secondary transition hover:border-accent/40 hover:text-accent"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
