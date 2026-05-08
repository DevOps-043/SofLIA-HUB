import { Notification } from 'electron';
import { logBootstrapError } from './bootstrap-steps';
import type { MainRuntimeState } from './runtime-state';

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
    if (data?.executionMode === 'workflow' && data?.workflowId) {
      void executePassiveWorkflow(services, data);
      return;
    }
    if (!state.waAgent || !services.waService.getStatus().connected) return;
    const jid = `${String(data.phoneNumber || '').replace(/\D/g, '')}@s.whatsapp.net`;
    void state.waAgent.handleScheduledTaskTrigger(jid, data.phoneNumber, data);
  });

  registerCalendarEvents(services, state);
  registerMonitoringEvents(modules, services, state);
  services.waService.on('qr', (qr: string) => state.win?.webContents.send('whatsapp:qr', qr));
  services.waService.on('status', (status: any) => state.win?.webContents.send('whatsapp:status', status));
}

async function executePassiveWorkflow(services: any, data: any): Promise<void> {
  try {
    const detail = await services.workflowHubService.executeWorkflow({
      workflowId: data.workflowId,
      requestedBy: data.requestedBy || 'scheduler',
      input: data.workflowInput || {},
    });
    const phoneNumber = String(data.phoneNumber || '').replace(/\D/g, '');
    if (!phoneNumber || !services.waService.getStatus().connected) return;
    const message = [
      `Workflow pasivo ejecutado: ${detail.workflowName}`,
      `Caso: ${detail.title}`,
      `Estado: ${detail.normalizedStatus}`,
      detail.summary ? `Resumen: ${detail.summary}` : '',
    ].filter(Boolean).join('\n');
    await services.waService.sendText(`${phoneNumber}@s.whatsapp.net`, message);
  } catch (error) {
    console.error('[Main] Passive workflow execution failed:', error);
  }
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
