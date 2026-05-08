import type { WAMessage } from '@whiskeysockets/baileys';
import { handleCommandExecutionRequest } from './command-approval';
import { sendPathAsZip } from './file-transfer';
import { handleQuickConversion } from './quick-conversion';
import { getSystemStatus, lockComputer } from './system-actions';
import type { IncomingTextOptions } from './types';

function isQuickConversionCommand(command: string): boolean {
  return command === 'generar pdf' || command === 'resumir';
}

async function handleEmergencyLock(jid: string, sendMessage: IncomingTextOptions['sendMessage']): Promise<void> {
  try {
    lockComputer();
    await sendMessage(jid, '*PC Bloqueado* de forma inmediata e incondicional.');
  } catch (error: any) {
    console.error('[WhatsAppRemoteHub] Error al bloquear PC:', error);
    await sendMessage(jid, `Error al bloquear el PC: ${error.message}`);
  }
}

async function tryQuickConversion(options: IncomingTextOptions, command: string, message?: WAMessage): Promise<boolean> {
  if (!isQuickConversionCommand(command)) return false;
  const pending = options.pendingConversions.get(options.jid);
  if (!pending) return false;

  await handleQuickConversion({
    socket: options.socket,
    command,
    pending,
    jid: options.jid,
    message,
    sendMessage: options.sendMessage,
  });
  options.pendingConversions.delete(options.jid);
  return true;
}

export async function processIncomingText(options: IncomingTextOptions): Promise<void> {
  const textLower = options.text.toLowerCase().trim();
  const textUpper = options.text.toUpperCase().trim();

  if (await tryQuickConversion(options, textLower, options.message)) return;
  if (textUpper === 'BLOQUEAR' || textUpper === '!BLOQUEAR') {
    await handleEmergencyLock(options.jid, options.sendMessage);
    return;
  }

  if (textLower === 'estado del sistema' || textLower === '!estado') {
    await options.sendMessage(options.jid, await getSystemStatus());
    return;
  }

  if (textLower.startsWith('enviar archivo ') || textLower.startsWith('!enviar ')) {
    const filePath = options.text.replace(/^(enviar archivo |!enviar )/i, '').trim();
    await sendPathAsZip({ socket: options.socket, jid: options.jid, targetPath: filePath, sendMessage: options.sendMessage });
    return;
  }

  if (textLower.startsWith('ejecutar ') || textLower.startsWith('!exec ')) {
    const command = options.text.replace(/^(ejecutar |!exec )/i, '').trim();
    await handleCommandExecutionRequest({
      command,
      jid: options.jid,
      messageId: options.messageId || undefined,
      mainWindow: options.mainWindow,
      pendingApprovals: options.pendingApprovals,
      sendMessage: options.sendMessage,
    });
  }
}
