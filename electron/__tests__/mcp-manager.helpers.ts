import { vi } from 'vitest';

const fsMocks = vi.hoisted(() => {
  const mockWatcherClose = vi.fn();
  return {
    mockExistsSync: vi.fn((filePath: string) => Boolean(filePath)),
    mockMkdirSync: vi.fn((filePath: string, options?: { recursive?: boolean }) => {
      void filePath;
      void options;
    }),
    mockReaddirSync: vi.fn((directoryPath: string) => {
      void directoryPath;
      return [] as string[];
    }),
    mockStatSync: vi.fn((filePath: string) => {
      void filePath;
      return { isFile: () => true };
    }),
    mockReadFileSync: vi.fn((filePath: string) => {
      void filePath;
      return '';
    }),
    mockWatcherClose,
    mockWatch: vi.fn((directoryPath: string, options?: unknown, listener?: unknown) => {
      void directoryPath;
      void options;
      void listener;
      return { close: mockWatcherClose };
    }),
  };
});

vi.mock('fs', () => ({
  existsSync: fsMocks.mockExistsSync,
  mkdirSync: fsMocks.mockMkdirSync,
  readdirSync: fsMocks.mockReaddirSync,
  statSync: fsMocks.mockStatSync,
  readFileSync: fsMocks.mockReadFileSync,
  watch: fsMocks.mockWatch,
  default: {
    existsSync: fsMocks.mockExistsSync,
    mkdirSync: fsMocks.mockMkdirSync,
    readdirSync: fsMocks.mockReaddirSync,
    statSync: fsMocks.mockStatSync,
    readFileSync: fsMocks.mockReadFileSync,
    watch: fsMocks.mockWatch,
  },
}));

import * as mcpManagerModule from '../mcp-manager';
import type { ToolSchema } from '../mcp-manager';

type MCPManagerConstructor = typeof import('../mcp-manager').MCPManager;
const mcpExports = mcpManagerModule as typeof mcpManagerModule & {
  default?: Partial<typeof mcpManagerModule>;
};
const MCPManager: MCPManagerConstructor =
  (mcpExports.MCPManager ?? mcpExports.default?.MCPManager) as MCPManagerConstructor;

export const {
  mockExistsSync,
  mockMkdirSync,
  mockReaddirSync,
  mockStatSync,
  mockReadFileSync,
  mockWatch,
} = fsMocks;

export { MCPManager };

export function resetMcpMocks() {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(true);
  mockReaddirSync.mockReturnValue([]);
  mockStatSync.mockReturnValue({ isFile: () => true });
}

export function crearToolJson(name: string, description = 'Herramienta de prueba'): string {
  return JSON.stringify({
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: { input: { type: 'string', description: 'Entrada de prueba' } },
      required: ['input'],
      additionalProperties: false,
    },
  });
}

export function crearToolSchema(name: string, handler?: ToolSchema['handler']): ToolSchema {
  return {
    name,
    description: `Herramienta ${name}`,
    inputSchema: { type: 'object', properties: { input: { type: 'string' } }, additionalProperties: false },
    ...(handler ? {
      outputSchema: {
        type: 'object' as const,
        properties: { resultado: { type: 'string' as const }, valor: { type: 'number' as const } },
        required: ['resultado', 'valor'],
        additionalProperties: false as const,
      },
      runtime: {
        owner: 'test-platform',
        risk: 'read' as const,
        allowedAgents: ['whatsapp-agent' as const],
        hitl: 'never' as const,
        allowInGroups: false,
        timeoutMs: 1_000,
        audit: true as const,
      },
    } : {}),
    handler,
  };
}
