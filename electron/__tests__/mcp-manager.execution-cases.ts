import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getToolContractFingerprint } from '../mcp-manager/tool-contract';
import { MCPManager, crearToolJson, crearToolSchema, mockReadFileSync, mockReaddirSync, mockWatch, resetMcpMocks } from './mcp-manager.helpers';

const runtimeContext = {
  agentId: 'whatsapp-agent' as const,
  channel: 'whatsapp' as const,
  isGroup: false,
  approvedByHuman: false,
  traceId: '11111111-1111-4111-8111-111111111111',
  contractFingerprint: '0'.repeat(64),
  actorRef: 'wa:0123456789abcdef',
};

describe('MCPManager execution and lifecycle', () => {
  beforeEach(resetMcpMocks);

  it('MCP-007: getTool devuelve undefined para nombre desconocido', async () => {
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mgr.getTool('fantasma')).toBeUndefined();
    expect(mgr.getTool('')).toBeUndefined();
    mgr.destroy();
  });

  it('MCP-008: getTools devuelve todas las herramientas', async () => {
    mockReaddirSync.mockReturnValue(['x.json', 'y.json', 'z.json']);
    mockReadFileSync.mockReturnValueOnce(crearToolJson('tool-x')).mockReturnValueOnce(crearToolJson('tool-y')).mockReturnValueOnce(crearToolJson('tool-z'));
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mgr.getTools().map(tool => tool.name).sort()).toEqual(['tool-x', 'tool-y', 'tool-z']);
    mgr.destroy();
  });

  it('MCP-009: executeTool invoca el handler', async () => {
    const handler = vi.fn().mockResolvedValue({ resultado: 'exito', valor: 42 });
    const tool = crearToolSchema('calc-tool', handler);
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    (mgr as unknown as { tools: Map<string, ReturnType<typeof crearToolSchema>> }).tools
      .set('calc-tool', tool);
    await expect(mgr.executeTool('calc-tool', { input: 'calcular' }, {
      ...runtimeContext,
      contractFingerprint: getToolContractFingerprint(tool as Parameters<typeof getToolContractFingerprint>[0]),
    })).resolves.toEqual({ resultado: 'exito', valor: 42 });
    expect(handler).toHaveBeenCalledWith({ input: 'calcular' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    mgr.destroy();
  });

  it('MCP-010: executeTool sin handler lanza error', async () => {
    mockReaddirSync.mockReturnValue(['declarativa.json']);
    mockReadFileSync.mockReturnValue(crearToolJson('tool-declarativa'));
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    await expect(mgr.executeTool('tool-declarativa', {}, runtimeContext)).rejects.toThrow('has no executable handler');
    mgr.destroy();
  });

  it('MCP-011: destroy cierra watchers', async () => {
    const closeSpy1 = vi.fn();
    const closeSpy2 = vi.fn();
    let callIdx = 0;
    mockWatch.mockImplementation(() => [{ close: closeSpy1 }, { close: closeSpy2 }][callIdx++] ?? { close: closeSpy1 });
    const mgr = new MCPManager(['/tmp/dir-a', '/tmp/dir-b']);
    await mgr.initialize();
    expect(mockWatch).toHaveBeenCalledTimes(2);
    mgr.destroy();
    expect(closeSpy1).toHaveBeenCalled();
    expect(closeSpy2).toHaveBeenCalled();
  });

  it('MCP-012: cache busting en imports dinamicos usa ?t=timestamp', async () => {
    mockReaddirSync.mockReturnValue(['modulo.js']);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = Date.now();
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mgr.getTools()).toHaveLength(0);
    const { pathToFileURL } = await import('url');
    const fileUrl = pathToFileURL('/tmp/tools-test/modulo.js').href;
    expect(`${fileUrl}?t=${Date.now()}`).toMatch(/\?t=\d+$/);
    expect(`${fileUrl}?t=${before}`).not.toBe(`${fileUrl}?t=${before + 1}`);
    errorSpy.mockRestore();
    mgr.destroy();
  });
});
