import { Notification } from 'electron';
import { logBootstrapError } from './bootstrap-steps';
import type { MainRuntimeState } from './runtime-state';
import type { SkillChannel } from '../../src/shared/skills/types';

export function registerServiceEvents(input: { modules: any; services: any; state: MainRuntimeState; controls: any }): void {
  const { modules, services, state } = input;
  services.meetingPassiveDetectionService.on('meeting-detected', (payload: any) => {
    state.win?.webContents.send('meeting:detected', payload);
    if (Notification.isSupported()) {
      new Notification({
        title: 'Nueva reunion detectada',
        body: `${payload.meetingTitle || payload.sourceFileName || 'Reunion sin titulo'} lista para revision HITL en Meeting Ops.`,
      }).show();
    }
  });

  services.taskScheduler.on('task-triggered', (data: any) => {
    void runPassiveSkill({ modules, services, state, controls: input.controls, task: data });
  });

  registerCalendarEvents(services, state);
  registerMonitoringEvents(modules, services, state);
  services.waService.on('qr', (qr: string) => state.win?.webContents.send('whatsapp:qr', qr));
  services.waService.on('status', (status: any) => state.win?.webContents.send('whatsapp:status', status));
}

/**
 * Disparo de una Skill pasiva.
 *
 * Antes de este cambio el destino estaba cableado a WhatsApp: si la sesion
 * estaba desconectada, el resultado se perdia aunque el usuario estuviera
 * delante de la computadora. Ahora la regla declara sus canales y la entrega se
 * reparte entre ellos, aislando el fallo de cada uno.
 */
async function runPassiveSkill(input: {
  modules: any;
  services: any;
  state: MainRuntimeState;
  controls: any;
  task: any;
}): Promise<void> {
  const { services, state, controls, task } = input;
  const channels: SkillChannel[] = Array.isArray(task?.channels) && task.channels.length > 0
    ? task.channels
    : ['whatsapp'];
  const title = String(task?.name || 'Skill pasiva');

  try {
    const text = await executePassiveSkillPrompt(state, task);
    if (!text) return;

    const { deliverToChannels } = await import('../passive-skills/delivery');
    await deliverToChannels(text, { channels, phoneNumber: task?.phoneNumber, title }, {
      sendWhatsApp: services.waService.getStatus().connected
        ? async (phoneNumber: string, message: string) => {
            const jid = `${phoneNumber}@s.whatsapp.net`;
            await services.waService.sendText(jid, message);
            // El resultado entra en el historial de esa conversacion solo
            // cuando salio por ahi: es donde el usuario podria preguntar por el.
            const { recordScheduledTaskDelivery } = await import('../wa-agent/scheduled-task-trigger');
            recordScheduledTaskDelivery({
              waService: services.waService,
              jid,
              senderNumber: String(task?.phoneNumber || ''),
              task,
              response: message,
            });
          }
        : undefined,
      sendTelegram: services.telegramService?.isConfigured?.()
        ? (message: string) => services.telegramService.sendToPrincipalChat(message)
        : undefined,
      announceOnOrb: controls?.orbAnnouncements
        ? (message: string, meta: { title: string }) => controls.orbAnnouncements.announce(message, meta)
        : undefined,
    });
  } catch (error) {
    // Un fallo no cancela la programacion: la Skill sigue activa para su
    // siguiente disparo. Solo queda constancia.
    console.error(`[SkillsPasivas] "${title}" fallo al ejecutarse:`, error);
  }
}

/**
 * Ejecuta el prompt de la regla y devuelve el texto a entregar.
 *
 * Se apoya en el agente de WhatsApp porque es el unico bucle de agente que
 * corre en main sin depender de que haya una ventana abierta, que es
 * justamente la condicion de una rutina programada.
 */
async function executePassiveSkillPrompt(state: MainRuntimeState, task: any): Promise<string> {
  if (!state.waAgent) {
    console.warn('[SkillsPasivas] No hay agente disponible para ejecutar la rutina.');
    return '';
  }
  const phoneNumber = String(task?.phoneNumber || '').replace(/\D/g, '');
  const jid = phoneNumber ? `${phoneNumber}@s.whatsapp.net` : '';
  const result = await state.waAgent.handleScheduledTaskTrigger(jid, task?.phoneNumber, task);
  return typeof result === 'string' ? result : '';
}

function registerCalendarEvents(services: any, state: MainRuntimeState): void {
  services.calendarService.setConfig({
    google: {
      clientId: process.env.VITE_GOOGLE_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET || '',
    },
    microsoft: { clientId: process.env.VITE_MICROSOFT_CLIENT_ID || '' },
  });
  services.calendarService.on('work-start', (data: any) => state.win?.webContents.send('calendar:work-start', data));
  services.calendarService.on('work-end', (data: any) => state.win?.webContents.send('calendar:work-end', data));
  services.calendarService.on('connected', (data: any) => {
    if (data?.provider === 'google') {
      void services.meetingPassiveDetectionService.runScanNow().catch((error: unknown) => {
        console.error('[Main] meetingPassiveDetectionService.runScanNow after Google connect failed:', error);
      });
    }
  });
}

function registerMonitoringEvents(modules: any, services: any, state: MainRuntimeState): void {
  services.monitoringService.on('session-ended', async (data: any) => {
    const snapshots = data.allSnapshots?.length ? data.allSnapshots : data.pendingSnapshots;
    if (!state.currentGeminiApiKey || !snapshots?.length) return;
    try {
      const summary = await modules.generateDailySummary(state.currentGeminiApiKey, snapshots.map(normalizeSnapshot), {
        startedAt: new Date().toISOString(),
        triggerType: 'manual',
      });
      state.win?.webContents.send('monitoring:summary-generated', { userId: data.userId, sessionId: data.sessionId, summary });
    } catch (error) {
      logBootstrapError('monitoring session summary', error);
    }
  });
}

function normalizeSnapshot(snapshot: any) {
  return {
    timestamp: typeof snapshot.timestamp === 'string' ? snapshot.timestamp : new Date(snapshot.timestamp).toISOString(),
    windowTitle: snapshot.windowTitle || '',
    processName: snapshot.processName || '',
    url: snapshot.url,
    idle: snapshot.idle || false,
    idleSeconds: snapshot.idleSeconds || 0,
    ocrText: snapshot.ocrText,
    durationSeconds: 30,
  };
}
