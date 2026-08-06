import type { BrowserWindow } from 'electron';
import { executeSystemCommand } from './command-execution';
import { SandboxGatekeeper } from './sandbox';
import type { PendingCommand, SendTextMessage } from './types';

interface CommandApprovalOptions {
  command: string;
  jid: string;
  messageId?: string;
  mainWindow: BrowserWindow | null;
  pendingApprovals: Map<string, PendingCommand>;
  sendMessage: SendTextMessage;
}

interface SecurityAlertResponseOptions {
  commandId: string;
  approved: boolean;
  pendingApprovals: Map<string, PendingCommand>;
  sendMessage: SendTextMessage;
}

function emitSecurityAlert(mainWindow: BrowserWindow | null, payload: Record<string, unknown>): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('security-alert', payload);
  }
}

export async function handleCommandExecutionRequest(options: CommandApprovalOptions): Promise<void> {
  const { command, jid, messageId, mainWindow, pendingApprovals, sendMessage } = options;
  const validationResult = SandboxGatekeeper.validate({ text: command, jid, messageId });

  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues[0]?.message || 'Comando bloqueado por seguridad.';
    console.warn(`[SandboxGatekeeper] Bloqueo proactivo: ${command}`);
    await sendMessage(jid, `*ALERTA DE SEGURIDAD*\n\n${errorMessage}`);
    emitSecurityAlert(mainWindow, { type: 'BLOCKED', command, jid, reason: errorMessage, timestamp: Date.now() });
    return;
  }

  const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  pendingApprovals.set(commandId, { id: commandId, command, jid, messageId, timestamp: Date.now() });
  await sendMessage(jid, `*Aprobacion Requerida*\n\nEl comando \`${command}\` esta retenido. Esperando aprobacion explicita en el escritorio.`);
  emitSecurityAlert(mainWindow, { type: 'APPROVAL_REQUIRED', commandId, command, jid, timestamp: Date.now() });
}

export async function handleSecurityAlertResponse(options: SecurityAlertResponseOptions): Promise<void> {
  const { commandId, approved, pendingApprovals, sendMessage } = options;
  const pending = pendingApprovals.get(commandId);
  if (!pending) return;

  pendingApprovals.delete(commandId);
  if (!approved) {
    await sendMessage(pending.jid, 'Ejecucion denegada en el escritorio.');
    return;
  }

  await sendMessage(pending.jid, 'Ejecucion aprobada en el escritorio. Ejecutando...');
  await executeSystemCommand(pending.command, pending.jid, sendMessage);
}
