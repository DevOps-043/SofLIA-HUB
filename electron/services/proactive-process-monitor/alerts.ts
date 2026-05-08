import type { WhatsAppService } from '../../whatsapp-service';
import type { ProcessState, ProactiveMonitorConfig } from './types';

interface SendProcessAlertInput {
  pid: number;
  state: ProcessState;
  config: ProactiveMonitorConfig;
  waService: WhatsAppService | null;
  emit: (eventName: string, payload: unknown) => boolean;
}

export async function sendProcessAlert(input: SendProcessAlertInput) {
  const alertMsg = buildAlertMessage(input.pid, input.state, input.config);
  console.log(`[ProactiveProcessMonitor] ALERT: ${alertMsg.replace(/\n/g, ' ')}`);
  input.emit('alert', { pid: input.pid, name: input.state.name, message: alertMsg });

  if (!input.waService) return;
  const status = input.waService.getStatus();
  if (!status.connected) return;

  const targetPhone = input.config.notifyPhone || status.allowedNumbers?.[0];
  if (!targetPhone) {
    console.warn('[ProactiveProcessMonitor] No target phone configured to send WhatsApp alert');
    return;
  }

  try {
    const cleanNumber = targetPhone.replace(/[^0-9]/g, '');
    await input.waService.sendText(`${cleanNumber}@s.whatsapp.net`, alertMsg);
  } catch (err: any) {
    console.error('[ProactiveProcessMonitor] Failed to send WhatsApp alert:', err.message);
  }
}

function buildAlertMessage(pid: number, state: ProcessState, config: ProactiveMonitorConfig) {
  const minutes = (config.consecutiveChecksToAlert * config.checkIntervalMs) / 60000;
  return [
    '*Alerta de Rendimiento*',
    `El proceso *${state.name}* (PID: ${pid}) lleva ${minutes} minutos consumiendo mas del ${config.cpuThresholdPercent}% de CPU y ${state.lastMem.toFixed(1)}% de memoria.`,
    '',
    `Deseas forzar el cierre? Responde: "Cierra el proceso ${pid}" o "Mata el proceso ${state.name}".`,
  ].join('\n');
}
