import { vi } from 'vitest';

const fsMocks = vi.hoisted(() => {
  const mockWatcherClose = vi.fn();
  return {
    mockExistsSync: vi.fn((_: string) => true),
    mockMkdirSync: vi.fn((_: string, __?: { recursive?: boolean }) => undefined),
    mockReaddirSync: vi.fn((_: string) => [] as string[]),
    mockStatSync: vi.fn((_: string) => ({ isFile: () => true })),
    mockReadFileSync: vi.fn((_: string) => ''),
    mockWatcherClose,
    mockWatch: vi.fn((_: string, __?: unknown, ___?: unknown) => ({ close: mockWatcherClose })),
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
    },
  });
}

export function crearToolSchema(name: string, handler?: (args: any) => any): ToolSchema {
  return {
    name,
    description: `Herramienta ${name}`,
    inputSchema: { type: 'object', properties: { input: { type: 'string' } } },
    handler,
  };
}
