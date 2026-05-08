import { describeSchedule } from './formatters';
import type { PassiveScheduleFrequency } from './types';
import type { WorkflowHubController } from './useWorkflowHubController';

export function PassiveWorkflowEditor({ controller }: { controller: WorkflowHubController }) {
  const workflow = controller.selectedWorkflow;
  if (!workflow) return null;
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Workflow pasivo</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {workflow.passiveBehavior === 'system'
            ? 'Este flujo corre solo en segundo plano y se refleja en la bandeja de casos.'
            : 'Programa este flujo para que se ejecute sin comando y quede recordado por el sistema.'}
        </p>
      </div>
      {workflow.passiveBehavior === 'system' ? (
        <div className="rounded-xl border border-cyan-500/20 bg-white/70 dark:bg-black/10 px-4 py-3 text-xs text-cyan-700 dark:text-cyan-200">
          Reuniones ya funciona como workflow pasivo de sistema. SofLIA revisa Calendar, Gmail y Drive para detectar artifacts, y tambien puede arrancar trazabilidad viva cuando una extension dispara `soflia://meeting-trigger`.
        </div>
      ) : <PassiveWorkflowForm controller={controller} />}
    </div>
  );
}

function PassiveWorkflowForm({ controller }: { controller: WorkflowHubController }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={controller.inputClass} value={controller.passiveRuleName} onChange={(event) => controller.setPassiveRuleName(event.target.value)} placeholder="Nombre del workflow pasivo" />
        <select className={controller.inputClass} value={controller.scheduleFrequency} onChange={(event) => controller.setScheduleFrequency(event.target.value as PassiveScheduleFrequency)}>
          <option value="daily">Todos los dias</option>
          <option value="weekdays">Lunes a viernes</option>
          <option value="weekly">Semanal</option>
        </select>
      </div>
      <textarea className={controller.textareaClass} value={controller.passiveRuleDescription} onChange={(event) => controller.setPassiveRuleDescription(event.target.value)} placeholder="Descripcion corta" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input className={controller.inputClass} type="time" value={controller.scheduleTime} onChange={(event) => controller.setScheduleTime(event.target.value)} />
        {controller.scheduleFrequency === 'weekly'
          ? <WeekdaySelect controller={controller} />
          : <div className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">{describeSchedule(controller.scheduleFrequency, controller.scheduleTime, controller.scheduleWeekday)}</div>}
      </div>
      <button type="button" className="w-full rounded-xl border border-cyan-500/20 bg-cyan-500/10 hover:bg-cyan-500/15 text-cyan-700 dark:text-cyan-200 py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runAction('save-passive-workflow', async () => {
          if (!controller.selectedWorkflow) throw new Error('Selecciona un workflow.');
          await controller.persistPassiveWorkflow({ workflowId: controller.selectedWorkflow.id, executionMode: 'workflow' });
        })}
        disabled={controller.actionKey === 'save-passive-workflow'}>
        {controller.actionKey === 'save-passive-workflow' ? 'Guardando...' : 'Guardar como workflow pasivo'}
      </button>
    </>
  );
}

function WeekdaySelect({ controller }: { controller: WorkflowHubController }) {
  return (
    <select className={controller.inputClass} value={controller.scheduleWeekday} onChange={(event) => controller.setScheduleWeekday(event.target.value)}>
      <option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miercoles</option>
      <option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sabado</option><option value="0">Domingo</option>
    </select>
  );
}
