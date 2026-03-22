/**
 * Tests WA-081 to WA-108: WhatsApp tool executor — dispatch, security, and confirmation logic.
 *
 * The executeWhatsAppTools function has heavy Electron + service dependencies.
 * We mock all external modules and test the security/dispatch logic.
 */
import { describe, it, expect, vi } from 'vitest';
import { CONFIRM_TOOLS_WA, GROUP_BLOCKED_TOOLS } from '../whatsapp-tools';

// ─── Mock all heavy dependencies before importing the executor ─────
vi.mock('../computer-use-handlers', () => ({
  executeToolDirect: vi.fn(async () => ({ success: true })),
}));

vi.mock('../whatsapp-prompts', () => ({
  smartFindFile: vi.fn(async () => ({ found: false })),
  webSearch: vi.fn(async () => ({ results: [] })),
  readWebpage: vi.fn(async () => ({ content: '' })),
}));

vi.mock('../agent-task-queue', () => ({
  handleTaskQueueTool: vi.fn(async () => null),
}));

vi.mock('../task-scheduler', () => ({
  handleTaskSchedulerTool: vi.fn(async () => null),
  TaskScheduler: vi.fn(),
}));

vi.mock('../whatsapp-executors/google-executors', () => ({
  isGoogleTool: vi.fn((name: string) => name.startsWith('gmail_') || name.startsWith('google_calendar_') || name.startsWith('drive_') || name.startsWith('gchat_')),
  executeGoogleTool: vi.fn(async (name: string) => ({
    response: { functionResponse: { name, response: { success: true, message: 'google mock' } } },
    bulkLabelsToVerify: null,
  })),
}));

vi.mock('../whatsapp-executors/iris-executors', () => ({
  isIrisTool: vi.fn((name: string) => name.startsWith('iris_')),
  executeIrisTool: vi.fn(async (name: string) => ({
    functionResponse: { name, response: { success: true, message: 'iris mock' } },
  })),
}));

vi.mock('../whatsapp-executors/system-executors', () => ({
  isSystemTool: vi.fn((name: string) => {
    const set = new Set(['list_processes', 'kill_process', 'lock_session',
      'shutdown_computer', 'restart_computer', 'sleep_computer', 'cancel_shutdown',
      'set_volume', 'toggle_wifi', 'run_in_terminal', 'run_claude_code',
      'run_background_command', 'list_process_sessions', 'poll_process_session',
      'kill_process_session', 'get_background_host_status', 'repair_background_host']);
    return set.has(name);
  }),
  executeSystemTool: vi.fn(async (name: string) => ({
    functionResponse: { name, response: { success: true, message: 'system mock' } },
  })),
}));

vi.mock('../dynamic-tool-service', () => ({
  dynamicToolService: {
    listTools: vi.fn(async () => []),
    listInstallableToolsets: vi.fn(async () => []),
    listInstalledToolsets: vi.fn(async () => []),
    doctorToolsets: vi.fn(async () => []),
    installToolset: vi.fn(async () => ({ success: true })),
    uninstallToolset: vi.fn(async () => ({ success: true })),
    installHomeAssistantToolset: vi.fn(async () => ({ success: true })),
    hasTool: vi.fn(async () => false),
    executeTool: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('../remote-node-service', () => ({
  remoteNodeService: {
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

vi.mock('../smart-search-tool', () => ({
  SmartSearchTool: vi.fn(),
}));

// Import after mocks
import { executeWhatsAppTools } from '../whatsapp-tool-executor';
import type { ToolExecutorContext } from '../whatsapp-tool-executor';

// ─── Helpers ───────────────────────────────────────────────────────

/** Build a minimal mock context */
function makeCtx(overrides: Partial<ToolExecutorContext> = {}): ToolExecutorContext {
  return {
    waService: { sendFile: vi.fn(async () => {}) } as any,
    calendarService: null,
    gmailService: null,
    driveService: null,
    gchatService: null,
    desktopAgent: null,
    clipboardAssistant: null,
    taskScheduler: null,
    neuralOrganizer: null,
    smartSearch: null,
    memory: { storeFact: vi.fn(), searchSemantic: vi.fn(), getStats: vi.fn() } as any,
    knowledge: { save: vi.fn(), search: vi.fn() } as any,
    getGenAI: vi.fn() as any,
    requestConfirmation: vi.fn(async () => true),
    ...overrides,
  };
}

/** Create a function call part for the executor */
function fc(name: string, args: Record<string, any> = {}) {
  return { functionCall: { name, args } };
}

// ─── SOFLIA_BLOCKED_PATHS regex patterns (extracted from source) ──
// We reproduce the regex array here to test path blocking independently
const SOFLIA_BLOCKED_PATHS = [
  /soflia[\s_-]*hub/i,
  /dist[\\/\-]electron/i,
  /app\.asar/i,
  /SOFLIA[\s_]*Source/i,
  /whatsapp[\s_-]*agent/i,
  /desktop[\s_-]*agent/i,
  /main[\s_-]*.*\.js/i,
  /electron[\\/].*\.(ts|js)/i,
  /src[\\/].*\.(tsx?|jsx?)/i,
  /\.env\b/i,
  /supabase/i,
  /api[\s_-]*key/i,
];

function isBlockedPath(value: string): boolean {
  return SOFLIA_BLOCKED_PATHS.some(p => p.test(value));
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('SOFLIA_BLOCKED_PATHS — regex pattern security', () => {
  // WA-081
  it('WA-081: blocks .env paths', () => {
    expect(isBlockedPath('.env')).toBe(true);
    expect(isBlockedPath('C:\\project\\.env')).toBe(true);
    expect(isBlockedPath('.env.local')).toBe(true);
  });

  // WA-082
  it('WA-082: blocks electron/ source files', () => {
    expect(isBlockedPath('electron/main.ts')).toBe(true);
    expect(isBlockedPath('electron\\whatsapp-agent.ts')).toBe(true);
    expect(isBlockedPath('electron/preload.js')).toBe(true);
  });

  // WA-083
  it('WA-083: blocks supabase paths', () => {
    expect(isBlockedPath('supabase')).toBe(true);
    expect(isBlockedPath('lib/supabase.ts')).toBe(true);
    expect(isBlockedPath('SUPABASE_URL')).toBe(true);
  });

  // WA-084
  it('WA-084: blocks api-key patterns', () => {
    expect(isBlockedPath('api-key')).toBe(true);
    expect(isBlockedPath('api_key')).toBe(true);
    expect(isBlockedPath('API KEY')).toBe(true);
  });

  // WA-085
  it('WA-085: blocks dist-electron and app.asar', () => {
    expect(isBlockedPath('dist-electron')).toBe(true);
    expect(isBlockedPath('dist/electron')).toBe(true);
    expect(isBlockedPath('dist\\electron')).toBe(true);
    expect(isBlockedPath('app.asar')).toBe(true);
    expect(isBlockedPath('resources/app.asar')).toBe(true);
  });

  // WA-086
  it('WA-086: blocks whatsapp-agent pattern', () => {
    expect(isBlockedPath('whatsapp-agent')).toBe(true);
    expect(isBlockedPath('whatsapp_agent')).toBe(true);
    expect(isBlockedPath('whatsapp agent')).toBe(true);
  });

  // WA-087
  it('WA-087: blocks SofLIA Hub and SOFLIA Source', () => {
    expect(isBlockedPath('SofLIA-Hub')).toBe(true);
    expect(isBlockedPath('soflia_hub')).toBe(true);
    expect(isBlockedPath('SOFLIA Source')).toBe(true);
    expect(isBlockedPath('SOFLIA_Source')).toBe(true);
  });

  // WA-088
  it('WA-088: blocks src/ source files', () => {
    expect(isBlockedPath('src/App.tsx')).toBe(true);
    expect(isBlockedPath('src\\services\\chat-service.ts')).toBe(true);
    expect(isBlockedPath('src/components/Sidebar.jsx')).toBe(true);
  });

  // WA-089
  it('WA-089: allows normal user paths', () => {
    expect(isBlockedPath('C:\\Users\\fysg5\\Documents\\reporte.pdf')).toBe(false);
    expect(isBlockedPath('D:\\Downloads\\foto.jpg')).toBe(false);
    expect(isBlockedPath('C:\\Users\\fysg5\\Desktop')).toBe(false);
    expect(isBlockedPath('mis documentos')).toBe(false);
  });

  // WA-090
  it('WA-090: allows normal file operations', () => {
    expect(isBlockedPath('C:\\Users\\fysg5\\OneDrive\\Escritorio\\archivo.txt')).toBe(false);
    expect(isBlockedPath('notas.md')).toBe(false);
    expect(isBlockedPath('C:\\Proyectos\\mi-app\\README.md')).toBe(false);
  });
});

describe('Group blocking — isGroup=true', () => {
  const ctx = makeCtx();

  // WA-091
  it('WA-091: blocks execute_command in group', async () => {
    const result = await executeWhatsAppTools([fc('execute_command', { command: 'dir' })], ctx, 'group-jid', '5511111', true);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.name).toBe('execute_command');
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('grupo');
  });

  // WA-092
  it('WA-092: blocks write_file in group', async () => {
    const result = await executeWhatsAppTools([fc('write_file', { path: 'test.txt', content: 'x' })], ctx, 'group-jid', '5511111', true);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
  });

  // WA-093
  it('WA-093: blocks delete_item in group', async () => {
    const result = await executeWhatsAppTools([fc('delete_item', { path: 'test.txt' })], ctx, 'group-jid', '5511111', true);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
  });

  // WA-094
  it('WA-094: blocks clipboard_write in group', async () => {
    const result = await executeWhatsAppTools([fc('clipboard_write', { text: 'hello' })], ctx, 'group-jid', '5511111', true);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
  });

  // WA-095
  it('WA-095: blocks use_computer in group', async () => {
    const result = await executeWhatsAppTools([fc('use_computer', { task: 'abrir chrome' })], ctx, 'group-jid', '5511111', true);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
  });

  // WA-096
  it('WA-096: all GROUP_BLOCKED_TOOLS are rejected in group context', async () => {
    for (const toolName of GROUP_BLOCKED_TOOLS) {
      const result = await executeWhatsAppTools([fc(toolName, {})], ctx, 'group-jid', '5511111', true);
      expect(result.responses).toHaveLength(1);
      expect(result.responses[0].functionResponse.response.success).toBe(false);
    }
  });
});

describe('Group allowing — safe tools pass in groups', () => {
  // WA-097
  it('WA-097: allows read_file in group (not group-blocked)', async () => {
    expect(GROUP_BLOCKED_TOOLS.has('read_file')).toBe(false);
  });

  // WA-098
  it('WA-098: allows list_directory in group', async () => {
    expect(GROUP_BLOCKED_TOOLS.has('list_directory')).toBe(false);
  });

  // WA-099
  it('WA-099: allows get_current_time equivalent (get_system_info) in group', async () => {
    expect(GROUP_BLOCKED_TOOLS.has('get_system_info')).toBe(false);
  });

  // WA-100
  it('WA-100: allows web_search in group', async () => {
    expect(GROUP_BLOCKED_TOOLS.has('web_search')).toBe(false);
  });
});

describe('Confirmation flow', () => {
  // WA-101
  it('WA-101: confirmation-required tool calls requestConfirmation', async () => {
    const requestConfirmation = vi.fn(async () => true);
    const ctx = makeCtx({ requestConfirmation });

    // delete_item requires confirmation, is not group blocked (we test outside group)
    await executeWhatsAppTools([fc('delete_item', { path: '/tmp/test.txt' })], ctx, 'jid', '5511111', false);
    expect(requestConfirmation).toHaveBeenCalled();
    expect(requestConfirmation).toHaveBeenCalledWith(
      'jid',
      '5511111',
      'delete_item',
      expect.any(String),
      expect.objectContaining({ path: '/tmp/test.txt' }),
    );
  });

  // WA-102
  it('WA-102: denied confirmation blocks execution', async () => {
    const requestConfirmation = vi.fn(async () => false);
    const ctx = makeCtx({ requestConfirmation });

    const result = await executeWhatsAppTools([fc('delete_item', { path: '/tmp/test.txt' })], ctx, 'jid', '5511111', false);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('cancelada');
  });

  // WA-103
  it('WA-103: accepted confirmation proceeds with execution', async () => {
    const requestConfirmation = vi.fn(async () => true);
    const ctx = makeCtx({ requestConfirmation });

    const result = await executeWhatsAppTools([fc('gmail_send', { to: 'a@b.com', subject: 'Hi', body: 'Hello' })], ctx, 'jid', '5511111', false);
    expect(requestConfirmation).toHaveBeenCalled();
    // The tool should proceed to the google executor (mocked to succeed)
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.name).toBe('gmail_send');
  });

  // WA-104
  it('WA-104: non-confirmation tools skip requestConfirmation', async () => {
    const requestConfirmation = vi.fn(async () => true);
    const ctx = makeCtx({ requestConfirmation });

    // read_file is not in CONFIRM_TOOLS_WA
    expect(CONFIRM_TOOLS_WA.has('read_file')).toBe(false);
    await executeWhatsAppTools([fc('iris_get_teams', {})], ctx, 'jid', '5511111', false);
    expect(requestConfirmation).not.toHaveBeenCalled();
  });
});

describe('Dispatch to delegated executors', () => {
  // WA-105
  it('WA-105: dispatches iris_* tools to iris executor', async () => {
    const { executeIrisTool } = await import('../whatsapp-executors/iris-executors');
    const ctx = makeCtx();

    await executeWhatsAppTools([fc('iris_get_teams', {})], ctx, 'jid', '5511111', false);
    expect(executeIrisTool).toHaveBeenCalledWith('iris_get_teams', {}, '5511111');
  });

  // WA-106
  it('WA-106: dispatches gmail_send to google executor (after confirmation)', async () => {
    const { executeGoogleTool } = await import('../whatsapp-executors/google-executors');
    const requestConfirmation = vi.fn(async () => true);
    const ctx = makeCtx({ requestConfirmation });

    await executeWhatsAppTools([fc('gmail_send', { to: 'x@y.com', subject: 'T', body: 'B' })], ctx, 'jid', '5511111', false);
    expect(executeGoogleTool).toHaveBeenCalled();
  });
});

describe('Path-blocking integration via executeWhatsAppTools', () => {
  // WA-107
  it('WA-107: blocks read_file targeting electron/ source', async () => {
    const ctx = makeCtx();
    const result = await executeWhatsAppTools([fc('read_file', { path: 'electron/main.ts' })], ctx, 'jid', '5511111', false);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('denegado');
  });

  // WA-108
  it('WA-108: blocks read_file targeting .env', async () => {
    const ctx = makeCtx();
    const result = await executeWhatsAppTools([fc('read_file', { path: '.env' })], ctx, 'jid', '5511111', false);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].functionResponse.response.success).toBe(false);
    expect(result.responses[0].functionResponse.response.error).toContain('denegado');
  });
});
