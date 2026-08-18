import { useCallback, useState, type JSX } from 'react';
import { catalogChannelsForSkill } from '../../shared/skills/channels';
import { SKILL_CHANNELS, type Skill, type SkillChannel } from '../../shared/skills/types';
import { saveSkillChannels } from '../../services/skills/skill-channels-store';

const CHANNEL_ICONS: Record<SkillChannel, JSX.Element> = {
  escritorio: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  whatsapp: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  ),
  telegram: (
    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
};

/**
 * Selector de canales de una Skill con estilo SOFIA Design System.
 *
 * Solo ofrece los canales que la Skill DECLARA: la elección del usuario acota
 * lo que el catálogo permite, nunca lo amplía.
 */
export function SkillChannelsSelector({
  skill,
  active,
  onChanged,
}: {
  skill: Skill;
  active: readonly SkillChannel[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState<SkillChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disponibles = catalogChannelsForSkill(skill);

  const toggle = useCallback(async (channel: SkillChannel) => {
    setSaving(channel);
    setError(null);
    try {
      const siguiente = active.includes(channel)
        ? active.filter((valor) => valor !== channel)
        : [...active, channel];
      await saveSkillChannels(skill.id, siguiente);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los canales.');
    } finally {
      setSaving(null);
    }
  }, [active, onChanged, skill.id]);

  if (disponibles.length <= 1) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {SKILL_CHANNELS.filter((channel) => disponibles.includes(channel.value)).map((channel) => {
          const encendido = active.includes(channel.value);
          return (
            <button
              key={channel.value}
              type="button"
              onClick={() => void toggle(channel.value)}
              disabled={saving !== null}
              aria-pressed={encendido}
              title={channel.description}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-150 disabled:opacity-50 ${
                encendido
                  ? 'border-accent/40 bg-accent/10 text-accent font-semibold shadow-xs ring-1 ring-accent/20'
                  : 'border-border/80 bg-surface-2/60 dark:bg-surface-2/40 text-secondary hover:border-accent/30 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              {saving === channel.value ? (
                <svg className="h-3 w-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                </svg>
              ) : (
                CHANNEL_ICONS[channel.value]
              )}
              <span>{channel.label}</span>
            </button>
          );
        })}
      </div>
      {active.length === 0 && (
        <p className="mt-1 text-[11px] text-secondary">
          Desactivada en todos los canales: no aparecerá en ninguna parte.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
