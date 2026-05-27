import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deletePassiveWorkflowRule,
  getWorkflowHubOverview,
  isWorkflowHubAvailable,
  savePassiveWorkflowRule,
  type PassiveWorkflowRule,
} from '../../services/workflow-hub-service';

interface WhatsAppFlowsCardProps {
  selectedTarget: string;
}

export function WhatsAppFlowsCard({ selectedTarget }: WhatsAppFlowsCardProps) {
  const [rules, setRules] = useState<PassiveWorkflowRule[]>([]);
  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 9 * * *');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = useMemo(() => parseFlowTarget(selectedTarget), [selectedTarget]);

  const loadRules = useCallback(async () => {
    if (!isWorkflowHubAvailable() || target.isGroup) return;
    setBusy('load');
    try {
      const result = await getWorkflowHubOverview();
      if (!result.success || !result.overview) throw new Error(result.error || 'Workflow Hub no disponible');
      setRules(result.overview.passiveRules.filter((rule) => matchesTarget(rule, target.phoneNumber)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude cargar los flujos');
    } finally {
      setBusy(null);
    }
  }, [target.isGroup, target.phoneNumber]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !prompt.trim()) {
      setError('Nombre e instruccion son obligatorios');
      return;
    }
    setBusy('save');
    try {
      const result = await savePassiveWorkflowRule({
        name: name.trim(),
        prompt: prompt.trim(),
        cronExpression: cronExpression.trim(),
        scheduleLabel: cronExpression.trim(),
        requestedBy: target.phoneNumber ? `app:whatsapp:${target.phoneNumber}` : 'app:whatsapp:global',
        phoneNumber: target.phoneNumber || null,
        source: 'app',
        executionMode: 'agent_prompt',
      });
      if (!result.success) throw new Error(result.error || 'No pude guardar el flujo');
      setName('');
      setPrompt('');
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude guardar el flujo');
    } finally {
      setBusy(null);
    }
  }, [cronExpression, loadRules, name, prompt, target.phoneNumber]);

  const handleDelete = useCallback(async (ruleId: string) => {
    setBusy(ruleId);
    try {
      const result = await deletePassiveWorkflowRule(ruleId);
      if (!result.success) throw new Error(result.error || 'No pude eliminar el flujo');
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude eliminar el flujo');
    } finally {
      setBusy(null);
    }
  }, [loadRules]);

  if (!isWorkflowHubAvailable() || target.isGroup) return null;

  return (
    <div className="bg-white dark:bg-white/3 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Flujos por Perfil</h4>
          <p className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">{target.label}</p>
        </div>
        <button
          type="button"
          onClick={loadRules}
          className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
        >
          {busy === 'load' ? '...' : 'Actualizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del flujo"
          className="px-3 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent/30 transition-all"
        />
        <input
          type="text"
          value={cronExpression}
          onChange={(event) => setCronExpression(event.target.value)}
          placeholder="0 9 * * *"
          className="px-3 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-accent/30 transition-all"
        />
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Instruccion que se ejecutara cuando se dispare"
          className="md:col-span-2 h-20 px-3 py-2.5 bg-gray-50 dark:bg-background-dark/80 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-xs focus:outline-none focus:border-accent/30 transition-all resize-none"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={busy === 'save'}
          className="px-4 py-2 bg-accent text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
        >
          {busy === 'save' ? 'Guardando' : 'Crear flujo'}
        </button>
      </div>

      {error && <p className="mt-3 text-[10px] text-red-400 font-semibold">{error}</p>}

      <div className="mt-5 space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
        {rules.length === 0 ? (
          <div className="py-5 text-center border border-dashed border-gray-200 dark:border-white/5 rounded-xl">
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Sin flujos guardados</p>
          </div>
        ) : rules.map((rule) => (
          <div key={rule.id} className="flex items-start justify-between gap-3 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-gray-800 dark:text-white truncate">{rule.name}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{rule.scheduleLabel}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{rule.prompt}</p>
            </div>
            {rule.source !== 'system' && (
              <button
                type="button"
                onClick={() => handleDelete(rule.id)}
                disabled={busy === rule.id}
                className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
              >
                {busy === rule.id ? '...' : 'Eliminar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function parseFlowTarget(selectedTarget: string): { phoneNumber: string | null; label: string; isGroup: boolean } {
  if (selectedTarget.startsWith('contact:')) {
    const phoneNumber = selectedTarget.slice('contact:'.length);
    return { phoneNumber, label: `Contacto +${phoneNumber}`, isGroup: false };
  }
  if (selectedTarget.startsWith('group:')) {
    return { phoneNumber: null, label: 'Grupo', isGroup: true };
  }
  return { phoneNumber: null, label: 'Perfil global', isGroup: false };
}

function matchesTarget(rule: PassiveWorkflowRule, phoneNumber: string | null): boolean {
  const rulePhone = String(rule.phoneNumber || '').replace(/\D/g, '');
  if (!phoneNumber) return !rulePhone;
  return rulePhone === phoneNumber.replace(/\D/g, '');
}
