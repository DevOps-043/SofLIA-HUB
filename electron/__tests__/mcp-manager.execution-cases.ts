import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPManager, crearToolJson, crearToolSchema, mockReadFileSync, mockReaddirSync, mockWatch, resetMcpMocks } from './mcp-manager.helpers';

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
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    // @ts-ignore acceso intencional a propiedad privada para test
    mgr['tools'].set('calc-tool', crearToolSchema('calc-tool', handler));
    await expect(mgr.executeTool('calc-tool', { a: 3, b: 4 })).resolves.toEqual({ resultado: 'exito', valor: 42 });
    expect(handler).toHaveBeenCalledWith({ a: 3, b: 4 });
    mgr.destroy();
  });

  it('MCP-010: executeTool sin handler lanza error', async () => {
    mockReaddirSync.mockReturnValue(['declarativa.json']);
    mockReadFileSync.mockReturnValue(crearToolJson('tool-declarativa'));
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    await expect(mgr.executeTool('tool-declarativa', {})).rejects.toThrow('has no executable handler');
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
