import { useCallback, useState } from 'react';
import { catalogChannelsForSkill } from '../../shared/skills/channels';
import { SKILL_CHANNELS, type Skill, type SkillChannel } from '../../shared/skills/types';
import { saveSkillChannels } from '../../services/skills/skill-channels-store';

/**
 * Selector de canales de una Skill.
 *
 * Solo ofrece los canales que la Skill DECLARA: la elección del usuario acota
 * lo que el catálogo permite, nunca lo amplía. Un canal que la Skill no declara
 * no aparece, en vez de aparecer y no funcionar.
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
              className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-50 ${
                encendido
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border bg-surface-2 text-secondary hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {saving === channel.value ? '...' : channel.label}
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
