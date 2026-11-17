import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Contrato de módulos/exportaciones del bootstrap anterior a la optimización.
const inventory: [string, string[]][] = [
  ['../integrated-browser', ["IntegratedBrowserService"]],
  ['../integrated-browser-handlers', ["registerIntegratedBrowserHandlers"]],
  ['../media-input/service', ["MediaInputService"]],
  ['../media-input-handlers', ["registerMediaInputHandlers"]],
  ['../desktop-context/service', ["DesktopContextService"]],
  ['../desktop-context-handlers', ["registerDesktopContextHandlers"]],
  ['../computer-use-handlers', ["registerComputerUseHandlers"]],
  ['../skill-workspace/service', ["SkillWorkspaceService"]],
  ['../skill-workspace-handlers', ["registerSkillWorkspaceHandlers"]],
  ['../skill-workspace/protocol', ["registerPresentationProtocolHandler"]],
  ['../skill-workspace/shared-instance', ["setSkillWorkspaceService"]],
  ['../whatsapp-service', ["WhatsAppService"]],
  ['../whatsapp-agent', ["WhatsAppAgent"]],
  ['../monitoring-service', ["MonitoringService"]],
  ['../monitoring-handlers', ["registerMonitoringHandlers"]],
  ['../calendar-service', ["CalendarService"]],
  ['../calendar-handlers', ["registerCalendarHandlers"]],
  ['../gmail-service', ["GmailService"]],
  ['../gmail-handlers', ["registerGmailHandlers"]],
  ['../drive-service', ["DriveService"]],
  ['../drive-handlers', ["registerDriveHandlers"]],
  ['../gchat-service', ["GChatService"]],
  ['../gchat-handlers', ["registerGChatHandlers"]],
  ['../desktop-agent-service', ["DesktopAgentService"]],
  ['../desktop-agent-handlers', ["registerDesktopAgentHandlers"]],
  ['../memory-service', ["MemoryService"]],
  ['../memory-handlers', ["registerMemoryHandlers"]],
  ['../knowledge-service', ["KnowledgeService"]],
  ['../updater-service', ["UpdaterService"]],
  ['../updater-handlers', ["registerUpdaterHandlers"]],
  ['../clipboard-ai-assistant', ["ClipboardAIAssistant"]],
  ['../task-scheduler', ["TaskScheduler"]],
  ['../neural-organizer', ["NeuralOrganizerService"]],
  ['../path-memory-service', ["PathMemoryService"]],
  ['../menu-manager', ["MenuManager"]],
  ['../meeting-handlers', ["registerMeetingHandlers"]],
  ['../meeting-live-handlers', ["createMeetingLiveService","registerMeetingLiveHandlers"]],
  ['../workspace-automation-service', ["WorkspaceAutomationService"]],
  ['../workspace-automation-handlers', ["registerWorkspaceAutomationHandlers"]],
  ['../passive-skills/service', ["PassiveSkillsService"]],
  ['../passive-skills-handlers', ["registerPassiveSkillsHandlers"]],
  ['../telegram-service', ["TelegramService"]],
  ['../telegram-handlers', ["registerTelegramHandlers"]],
  ['../communication-hub/service', ["CommunicationHubService"]],
  ['../communication-hub-handlers', ["registerCommunicationHubHandlers"]],
  ['../soflia-learning-service', ["SofliaLearningService"]],
  ['../meetings/meeting-store', ["MeetingStore"]],
  ['../meetings/meeting-source-service', ["MeetingSourceService"]],
  ['../meetings/meeting-ai-service', ["MeetingAIService"]],
  ['../meetings/meeting-review-service', ["MeetingReviewService"]],
  ['../meetings/meeting-sync-service', ["MeetingSyncService"]],
  ['../meetings/meeting-workflow-service', ["MeetingWorkflowService"]],
  ['../meetings/meeting-detection-store', ["MeetingDetectionStore"]],
  ['../meetings/meeting-passive-detection-service', ["MeetingPassiveDetectionService"]],
  ['../daily-briefing-service', ["DailyBriefingService"]],
  ['../background-host-service', ["backgroundHostService"]],
  ['../background-host-handlers', ["registerBackgroundHostHandlers"]],
  ['../remote-node-service', ["remoteNodeService"]],
  ['../remote-node-handlers', ["registerRemoteNodeHandlers"]],
  ['../dynamic-tool-service', ["dynamicToolService"]],
  ['../python-runtime-service', ["pythonRuntimeService"]],
  ['../voice-passive-handlers', ["registerVoicePassiveHandlers"]],
  ['../orb-ipc-handlers', ["registerOrbIpcHandlers"]],
  ['../python-tools-service', ["pythonToolsService"]],
  ['../python-tools-handlers', ["registerPythonToolsHandlers"]],
  ['../summary-generator', ["generateDailySummary"]],
  ['../agent-task-queue', []],
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { inventory.forEach(([id]) => vi.doUnmock(id)); });

function installMocks(wait?: ReturnType<typeof deferred<Record<string, object>>>) {
  const requested: string[] = [];
  const expected: Record<string, object> = {};
  inventory.forEach(([id, names], index) => {
    const exports = Object.fromEntries(names.map(name => [name, { modulo: id, nombre: name }]));
    Object.assign(expected, exports);
    vi.doMock(id, () => {
      requested.push(id);
      return index === 0 && wait ? wait.promise : exports;
    });
  });
  return { requested, expected };
}

describe('Carga concurrente de servicios del bootstrap', () => {
  it('solicita el resto mientras el primero tarda y conserva todos los exports', async () => {
    const first = deferred<Record<string, object>>();
    const { requested, expected } = installMocks(first);
    const { loadMainServiceModules } = await import('../main/service-modules');
    let complete = false;
    const pending = loadMainServiceModules().then(result => { complete = true; return result; });
    try {
      await vi.waitFor(() => expect(requested).toContain('../python-tools-handlers'));
      expect(complete).toBe(false);
      expect(requested).not.toContain('../agent-task-queue');
    } finally {
      first.resolve({ IntegratedBrowserService: expected.IntegratedBrowserService });
    }
    const result = await pending;
    expect(result).toEqual(expected);
    expect(Object.keys(result)).toHaveLength(67);
    expect(requested).toContain('../agent-task-queue');
  });

  it('rechaza un import fallido sin resolver un conjunto parcial', async () => {
    const first = deferred<Record<string, object>>();
    const { requested } = installMocks(first);
    const { loadMainServiceModules } = await import('../main/service-modules');
    const error = new Error('Fallo de módulo simulado');
    // Vitest envuelve el fallo de una factory conservando su causa original.
    const rejected = expect(loadMainServiceModules()).rejects.toMatchObject({ cause: error });
    first.reject(error);
    await rejected;
    expect(requested).not.toContain('../agent-task-queue');
  });
});
