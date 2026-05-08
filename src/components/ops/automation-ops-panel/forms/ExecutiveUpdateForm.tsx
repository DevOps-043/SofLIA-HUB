import { executeAutomationTemplate } from '../../../../services/automation-service';
import { inputClass, textareaClass } from '../styles';
import { SpaceSelect } from '../SpaceSelect';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function ExecutiveUpdateForm({ controller }: { controller: AutomationOpsController }) {
  const executive = controller.forms.executive;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Actualizacion ejecutiva en Chat</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Convierte una situacion en un mensaje listo para tu equipo.</p>
      </div>
      <SpaceSelect spaces={controller.data.spaces} value={executive.chatSpace} onChange={executive.setChatSpace} emptyLabel="Selecciona un espacio" />
      <textarea className={textareaClass} value={executive.context} onChange={(event) => executive.setContext(event.target.value)} placeholder="Avance del proyecto, riesgo detectado, decision requerida..." />
      <input className={inputClass} value={executive.tone} onChange={(event) => executive.setTone(event.target.value)} placeholder="Tono sugerido" />
      <button
        type="button"
        className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runner.runAction('run-executive-update', async () => {
          const result = await executeAutomationTemplate({ templateId: 'gchat_executive_update', requestedBy: `app:${controller.userId}`, input: { spaceName: executive.chatSpace, context: executive.context.trim(), tone: executive.tone.trim() || undefined } });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar la actualizacion.');
          await controller.data.refreshOverview(false);
          controller.data.setSelectedRunId(result.run.id);
          controller.runner.setNotice(`Caso creado: ${result.run.title}.`);
        })}
        disabled={controller.runner.actionKey === 'run-executive-update' || !executive.chatSpace || !executive.context.trim()}
      >
        {controller.runner.actionKey === 'run-executive-update' ? 'Preparando...' : 'Preparar mensaje ejecutivo'}
      </button>
    </div>
  );
}
