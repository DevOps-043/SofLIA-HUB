import { useCallback, useEffect, useState } from 'react';
import {
  deletePassiveSkill,
  getPassiveSkillsOverview,
  isPassiveSkillsAvailable,
  type PassiveSkillRule,
} from '../../services/passive-skills-service';
import { SKILL_CHANNELS } from '../../shared/skills/types';
import { Button } from '../ui';

/**
 * Skills pasivas: las que se ejecutan solas a su hora.
 *
 * Se listan junto a las Skills que el usuario invoca porque son lo mismo con
 * un disparador distinto — esa es toda la idea de unificar Flujos y Skills.
 *
 * Las detecciones automáticas del sistema aparecen aparte y sin controles: el
 * usuario tiene que saber que existen para no crear una rutina que duplique lo
 * que un servicio ya hace, pero no son programables.
 */
export function PassiveSkillsSection() {
  const [rules, setRules] = useState<PassiveSkillRule[]>([]);
  const [systemRules, setSystemRules] = useState<PassiveSkillRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isPassiveSkillsAvailable()) {
      setLoading(false);
      return;
    }
    try {
      const result = await getPassiveSkillsOverview();
      if (!result.success || !result.overview) throw new Error(result.error || 'No pude cargar las skills pasivas.');
      setRules(result.overview.rules);
      setSystemRules(result.overview.systemRules);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude cargar las skills pasivas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(async (ruleId: string) => {
    setBusy(ruleId);
    try {
      const result = await deletePassiveSkill(ruleId);
      if (!result.success) throw new Error(result.error || 'No pude eliminar la skill pasiva.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude eliminar la skill pasiva.');
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (!isPassiveSkillsAvailable()) return null;

  return (
    <section className="mt-7">
      <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Skills pasivas</h3>
      <p className="mb-2 text-xs text-secondary">
        Se ejecutan solas a la hora que fijes y te entregan el resultado por los canales que elijas.
        Puedes crearlas pidiéndomelo por chat: «cada día a las 8 dame las noticias de IA en la computadora».
      </p>

      {loading && <p className="py-4 text-center text-sm text-secondary">Cargando...</p>}

      {!loading && rules.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-secondary">
          No tienes ninguna skill pasiva programada.
        </p>
      )}

      <div className="space-y-2">
        {rules.map((rule) => (
          <article
            key={rule.id}
            className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
              <p className="mt-0.5 text-xs text-secondary">{rule.scheduleLabel}</p>
              <p className="mt-0.5 text-[11px] text-secondary/80">
                Llega por: {describeChannels(rule.channels)}
                {rule.lastRunAt ? ` · Última ejecución: ${formatDate(rule.lastRunAt)}` : ' · Aún no se ha ejecutado'}
              </p>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => void handleDelete(rule.id)}
              disabled={busy === rule.id}
            >
              {busy === rule.id ? '...' : 'Eliminar'}
            </Button>
          </article>
        ))}
      </div>

      {systemRules.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">Automáticas del sistema</h4>
          <div className="space-y-2">
            {systemRules.map((rule) => (
              <article key={rule.id} className="rounded-2xl border border-border bg-surface-2/60 p-3.5">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-mono uppercase ${
                    rule.status === 'system'
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'bg-warning/10 text-warning border border-warning/20'
                  }`}
                  >
                    {rule.status === 'system' ? 'Activa' : 'Bloqueada'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-secondary">{rule.scheduleLabel}</p>
                {rule.reason && <p className="mt-1 text-[11px] text-secondary/80">{rule.reason}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl border border-danger/25 bg-danger/[0.07] px-3.5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

function describeChannels(channels: readonly string[]): string {
  const etiquetas = channels.map(
    (canal) => SKILL_CHANNELS.find((entrada) => entrada.value === canal)?.label ?? canal,
  );
  if (etiquetas.length === 0) return 'ningún canal';
  if (etiquetas.length === 1) return etiquetas[0];
  return `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`;
}

function formatDate(value: string): string {
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleString('es-MX');
}
