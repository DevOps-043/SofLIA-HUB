import { ipcMain } from 'electron';
import { handleIPC } from './utils/ipc-helpers';
import type { SdoService } from './sdo/sdo-service';
import type {
  SdoAction,
  SdoApproveInput,
  SdoCreateActionInput,
  SdoCreateClaimInput,
  SdoCreateDecisionInput,
  SdoListFilters,
} from './sdo/sdo-types';

type SdoActionUpdates = Partial<Pick<SdoAction, 'description' | 'responsible' | 'due_date' | 'status' | 'external_ref' | 'review_due'>>;

/**
 * Handlers IPC del Registro Operativo Gobernado (SDO-AN).
 * Regla de gobierno: sdo:approve / sdo:reject solo existen como canal IPC
 * (UI del Hub, usuario SOFIA). Las herramientas de agente no tienen ruta
 * hacia la aprobacion.
 */
export function registerSdoHandlers(sdoService: SdoService): void {
  ipcMain.handle('sdo:list-decisions', (_event, filters?: SdoListFilters) =>
    handleIPC(async () => ({
      decisions: await sdoService.store.listarDecisiones(filters),
    })));

  ipcMain.handle('sdo:get-decision', (_event, decisionId: string) =>
    handleIPC(async () => {
      const decision = await sdoService.store.obtenerDecision(decisionId);
      if (!decision) throw new Error('No encontre la decision solicitada en el SDO.');
      const [approvals, audit] = await Promise.all([
        sdoService.store.listarAprobaciones('decision', decisionId),
        sdoService.store.listarBitacora('decision', decisionId),
      ]);
      return { decision, approvals, audit };
    }));

  ipcMain.handle('sdo:create-decision', (_event, input: SdoCreateDecisionInput) =>
    handleIPC(async () => ({
      decision: await sdoService.store.crearDecision(input),
    })));

  ipcMain.handle('sdo:list-claims', (_event, filters?: SdoListFilters) =>
    handleIPC(async () => ({
      claims: await sdoService.store.listarClaims(filters),
    })));

  ipcMain.handle('sdo:create-claim', (_event, input: SdoCreateClaimInput) =>
    handleIPC(async () => ({
      claim: await sdoService.store.crearClaim(input),
    })));

  ipcMain.handle('sdo:list-actions', (_event, filters?: SdoListFilters) =>
    handleIPC(async () => ({
      actions: await sdoService.store.listarAcciones(filters),
    })));

  ipcMain.handle('sdo:create-action', (_event, input: SdoCreateActionInput) =>
    handleIPC(async () => ({
      action: await sdoService.store.crearAccion(input),
    })));

  ipcMain.handle('sdo:update-action', (_event, input: { actionId: string; updates: SdoActionUpdates }) =>
    handleIPC(async () => ({
      action: await sdoService.store.actualizarAccion(input.actionId, input.updates),
    })));

  ipcMain.handle('sdo:approve', (_event, input: SdoApproveInput) =>
    handleIPC(async () => ({
      approval: await sdoService.store.aprobar(input),
    })));

  ipcMain.handle('sdo:reject', (_event, input: SdoApproveInput) =>
    handleIPC(async () => ({
      approval: await sdoService.store.rechazar(input),
    })));

  ipcMain.handle('sdo:list-audit', (_event, input: { objectType: string; objectId: string; limit?: number }) =>
    handleIPC(async () => ({
      events: await sdoService.store.listarBitacora(input.objectType, input.objectId, input.limit),
    })));

  ipcMain.handle('sdo:get-status', () =>
    handleIPC(async () => ({ status: sdoService.getStatus() })));

  console.log('[SdoHandlers] Registered successfully');
}
