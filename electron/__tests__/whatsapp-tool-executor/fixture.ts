import { vi } from 'vitest';

vi.mock('../../computer-use-handlers', () => ({ executeToolDirect: vi.fn(async () => ({ success: true })) }));
vi.mock('../../whatsapp-prompts', () => ({
  smartFindFile: vi.fn(async () => ({ found: false })),
  webSearch: vi.fn(async () => ({ results: [] })),
  readWebpage: vi.fn(async () => ({ content: '' })),
}));
vi.mock('../../agent-task-queue', () => ({ handleTaskQueueTool: vi.fn(async () => null) }));
vi.mock('../../task-scheduler', () => ({ handleTaskSchedulerTool: vi.fn(async () => null), TaskScheduler: vi.fn() }));
vi.mock('../../whatsapp-executors/google-executors', () => ({
  isGoogleTool: vi.fn((name: string) => ['gmail_', 'google_calendar_', 'drive_', 'gchat_'].some((prefix) => name.startsWith(prefix))),
  executeGoogleTool: vi.fn(async (name: string) => ({
    response: { functionResponse: { name, response: { success: true, message: 'google mock' } } },
    bulkLabelsToVerify: null,
  })),
}));
vi.mock('../../whatsapp-executors/iris-executors', () => ({
  isIrisTool: vi.fn((name: string) => name.startsWith('iris_')),
  executeIrisTool: vi.fn(async (name: string) => ({
    functionResponse: { name, response: { success: true, message: 'iris mock' } },
  })),
}));
vi.mock('../../whatsapp-executors/system-executors', () => ({
  isSystemTool: vi.fn((name: string) => new Set(['list_processes', 'kill_process', 'lock_session', 'shutdown_computer', 'restart_computer', 'sleep_computer', 'cancel_shutdown', 'set_volume', 'toggle_wifi', 'run_in_terminal', 'run_claude_code', 'run_background_command', 'list_process_sessions', 'poll_process_session', 'kill_process_session', 'get_background_host_status', 'repair_background_host']).has(name)),
  executeSystemTool: vi.fn(async (name: string) => ({ functionResponse: { name, response: { success: true, message: 'system mock' } } })),
}));
vi.mock('../../dynamic-tool-service', () => ({
  dynamicToolService: {
    listTools: vi.fn(async () => []),
    listInstallableToolsets: vi.fn(async () => []),
    listInstalledToolsets: vi.fn(async () => []),
    doctorToolsets: vi.fn(async () => []),
    installToolset: vi.fn(async () => ({ success: true })),
    uninstallToolset: vi.fn(async () => ({ success: true })),
    installHomeAssistantToolset: vi.fn(async () => ({ success: true })),
    hasTool: vi.fn(async () => false),
    getRuntimeDescriptor: vi.fn(async () => undefined),
    executeTool: vi.fn(async () => ({ success: true })),
  },
}));
vi.mock('../../remote-node-service', () => ({
  remoteNodeService: Object.fromEntries(['getHostStatus', 'updateHostConfig', 'registerNode', 'removeNode', 'testNode', 'openApplicationOnNode', 'runBackgroundCommandOnNode', 'useComputerOnNode', 'pollNodeProcessSession', 'killNodeProcessSession'].map((name) => [name, vi.fn(async () => ({}))]))
    && {
      getHostStatus: vi.fn(async () => ({})),
      updateHostConfig: vi.fn(async () => ({})),
      listNodes: vi.fn(async () => []),
      registerNode: vi.fn(async () => ({})),
      removeNode: vi.fn(async () => ({})),
      testNode: vi.fn(async () => ({})),
      openApplicationOnNode: vi.fn(async () => ({})),
      runBackgroundCommandOnNode: vi.fn(async () => ({})),
      useComputerOnNode: vi.fn(async () => ({})),
      listNodeProcessSessions: vi.fn(async () => []),
      pollNodeProcessSession: vi.fn(async () => ({})),
      killNodeProcessSession: vi.fn(async () => ({})),
    },
}));
vi.mock('../../app-chat-service', () => ({
  listAppChatConversations: vi.fn(async () => ({ success: true, count: 1, conversations: [{ id: 'conv-1', title: 'base de datos', permission: 'edit' }] })),
  getAppChatConversationContext: vi.fn(async (_phone: string, conversationRef: string) => ({ success: true, conversation: { id: 'conv-1', title: conversationRef, permission: 'edit' }, count: 1, messages: [] })),
  appendNoteToAppConversation: vi.fn(async (_phone: string, conversationRef: string, content: string) => ({ success: true, conversation: { id: 'conv-1', title: conversationRef, permission: 'edit' }, messageId: 'msg-new', content })),
  listAppChatConversationAssets: vi.fn(async () => ({ success: true, count: 1, assets: [{ asset_ref: 'source:1', file_name: 'reporte.pdf', sendable: true }] })),
  prepareAppChatAssetForDelivery: vi.fn(async (_phone: string, conversationRef: string, assetRef: string) => ({ success: true, conversation: { id: 'conv-1', title: conversationRef, permission: 'edit' }, prepared: { localPath: `C:/tmp/${assetRef.replace(/[^a-z0-9_-]/gi, '_')}.pdf`, caption: `Archivo de ${conversationRef}`, cleanupAfterSend: false } })),
}));
vi.mock('../../smart-search-tool', () => ({ SmartSearchTool: vi.fn() }));

import type { ToolExecutorContext } from '../../whatsapp-tool-executor';

const whatsappToolsModule = await vi.importActual<typeof import('../../whatsapp-tools')>('../../whatsapp-tools');
const whatsappExecutorModule = await vi.importActual<typeof import('../../whatsapp-tool-executor')>('../../whatsapp-tool-executor');

export const CONFIRM_TOOLS_WA = whatsappToolsModule.CONFIRM_TOOLS_WA;
export const GROUP_BLOCKED_TOOLS = whatsappToolsModule.GROUP_BLOCKED_TOOLS;
export const executeWhatsAppTools = whatsappExecutorModule.executeWhatsAppTools;

export function makeCtx(overrides: Partial<ToolExecutorContext> = {}): ToolExecutorContext {
  return {
    waService: { sendFile: vi.fn(async () => {}) } as unknown as ToolExecutorContext['waService'],
    calendarService: null, gmailService: null, driveService: null, gchatService: null, desktopAgent: null,
    clipboardAssistant: null, taskScheduler: null, neuralOrganizer: null, smartSearch: null,
    memory: { storeFact: vi.fn(), searchSemantic: vi.fn(), getStats: vi.fn() } as unknown as ToolExecutorContext['memory'],
    knowledge: { save: vi.fn(), search: vi.fn() } as unknown as ToolExecutorContext['knowledge'],
    getGenAI: vi.fn() as unknown as ToolExecutorContext['getGenAI'],
    requestConfirmation: vi.fn(async () => true),
    ...overrides,
  };
}

export function fc(name: string, args: Record<string, unknown> = {}) {
  return { functionCall: { name, args } };
}

export const SOFLIA_BLOCKED_PATHS = [/soflia[\s_-]*hub/i, /dist[\\/-]electron/i, /app\.asar/i, /SOFLIA[\s_]*Source/i, /whatsapp[\s_-]*agent/i, /desktop[\s_-]*agent/i, /main[\s_-]*.*\.js/i, /electron[\\/].*\.(ts|js)/i, /src[\\/].*\.(tsx?|jsx?)/i, /\.env\b/i, /supabase/i, /api[\s_-]*key/i];

export function isBlockedPath(value: string): boolean {
  return SOFLIA_BLOCKED_PATHS.some((pattern) => pattern.test(value));
}
