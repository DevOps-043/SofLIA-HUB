import { executeAutomationTemplate } from '../../../../services/automation-service';
import { inputClass } from '../styles';
import { SpaceSelect } from '../SpaceSelect';
import type { AutomationOpsController } from '../useAutomationOpsController';

export function DriveWorkspaceForm({ controller }: { controller: AutomationOpsController }) {
  const drive = controller.forms.drive;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-gray-900 dark:text-white">Espacio de proyecto en Drive</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Crea una estructura base de carpetas para un proyecto.</p>
      </div>
      <input className={inputClass} value={drive.projectName} onChange={(event) => drive.setProjectName(event.target.value)} placeholder="Nombre del proyecto o cliente" />
      <details className="rounded-xl border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-medium text-gray-700 dark:text-gray-300">Opciones avanzadas</summary>
        <div className="mt-3 space-y-2">
          <input className={inputClass} value={drive.parentFolderId} onChange={(event) => drive.setParentFolderId(event.target.value)} placeholder="Carpeta padre (opcional)" />
          <SpaceSelect spaces={controller.data.spaces} value={drive.chatSpace} onChange={drive.setChatSpace} emptyLabel="Sin aviso en Google Chat" />
        </div>
      </details>
      <button
        type="button"
        className="w-full rounded-xl border border-accent/20 bg-accent/10 hover:bg-accent/15 text-accent py-2.5 text-sm font-semibold transition disabled:opacity-40"
        onClick={() => void controller.runner.runAction('run-drive-workspace', async () => {
          const result = await executeAutomationTemplate({ templateId: 'drive_project_workspace', requestedBy: `app:${controller.userId}`, input: { projectName: drive.projectName.trim(), parentFolderId: drive.parentFolderId.trim() || undefined, gchatSpace: drive.chatSpace || undefined } });
          if (!result.success || !result.run) throw new Error(result.error || 'No pude preparar el espacio en Drive.');
          await controller.data.refreshOverview(false);
          controller.data.setSelectedRunId(result.run.id);
          controller.runner.setNotice(`Caso creado: ${result.run.title}.`);
        })}
        disabled={controller.runner.actionKey === 'run-drive-workspace' || !drive.projectName.trim()}
      >
        {controller.runner.actionKey === 'run-drive-workspace' ? 'Preparando...' : 'Crear espacio base'}
      </button>
    </div>
  );
}
