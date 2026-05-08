import { vi } from 'vitest';

vi.mock('../../iris-data-main', () => ({
  tryAutoAuthByPhone: vi.fn().mockResolvedValue({ success: false }),
  getWhatsAppSession: vi.fn().mockReturnValue(null),
  buildIrisContextForWhatsApp: vi.fn().mockResolvedValue(''),
  needsIrisData: vi.fn().mockReturnValue(false),
  isIrisAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock('../../whatsapp-workflow-presentacion', () => ({
  WorkflowManager: {
    isActive: vi.fn().mockReturnValue(false),
    handleMessage: vi.fn(),
    startWorkflow: vi.fn(),
    endWorkflow: vi.fn(),
  },
}));

vi.mock('../../whatsapp-workflow-meetings', () => ({
  MeetingWorkflowManager: {
    isActive: vi.fn().mockReturnValue(false),
    handleMessage: vi.fn(),
    startWorkflow: vi.fn(),
  },
}));

vi.mock('../../whatsapp-tools', () => ({
  WA_TOOL_DECLARATIONS: {
    functionDeclarations: [
      { name: 'web_search', description: 'Busca en internet', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING' } } } },
      { name: 'list_directory', description: 'Lista directorio', parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } } } },
    ],
  },
  GROUP_BLOCKED_TOOLS: new Set(['execute_command', 'delete_item', 'write_file']),
  BLOCKED_TOOLS_WA: new Set(),
  CONFIRM_TOOLS_WA: new Set(['delete_item', 'execute_command']),
}));

vi.mock('../../whatsapp-prompts', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue('Eres SOFLIA, asistente de productividad.'),
  classifyEvidenceRequirement: vi.fn().mockReturnValue('none'),
  detectActionRequest: vi.fn().mockReturnValue(false),
  formatForWhatsApp: vi.fn((text: string) => text),
}));

vi.mock('../../whatsapp-tool-executor', () => ({
  executeWhatsAppTools: vi.fn().mockResolvedValue({ responses: [], bulkLabelsToVerify: null }),
}));

vi.mock('../../dynamic-tool-service', () => ({
  dynamicToolService: { getGeminiFunctionDeclarations: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../../smart-search-tool', () => ({
  SmartSearchTool: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));
