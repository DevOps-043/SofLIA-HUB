import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPManager, crearToolJson, mockExistsSync, mockMkdirSync, mockReadFileSync, mockReaddirSync, resetMcpMocks } from './mcp-manager.helpers';

describe('MCPManager discovery', () => {
  beforeEach(resetMcpMocks);

  it('MCP-001: crea el directorio con recursive:true si no existe', async () => {
    mockExistsSync.mockReturnValue(false);
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining('tools-test'), { recursive: true });
    mgr.destroy();
  });

  it('MCP-002: carga herramientas validas desde archivos .json', async () => {
    mockReaddirSync.mockReturnValue(['saludo.json']);
    mockReadFileSync.mockReturnValue(crearToolJson('herramienta-saludo'));
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    const tool = mgr.getTool('herramienta-saludo');
    expect(tool?.name).toBe('herramienta-saludo');
    expect(tool?.description).toBe('Herramienta de prueba');
    expect(tool?.inputSchema.type).toBe('object');
    mgr.destroy();
  });

  it('MCP-003: maneja errores de import dinamico .ts/.js sin propagar', async () => {
    mockReaddirSync.mockReturnValue(['modulo.ts']);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mgr = new MCPManager('/tmp/tools-test');
    await expect(mgr.initialize()).resolves.not.toThrow();
    errorSpy.mockRestore();
    mgr.destroy();
  });

  it('MCP-004: rechaza esquemas incompletos y emite warn', async () => {
    mockReaddirSync.mockReturnValue(['invalido.json']);
    mockReadFileSync.mockReturnValue(JSON.stringify({ name: 'tool-rota', inputSchema: { type: 'object', properties: {} } }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mgr.getTool('tool-rota')).toBeUndefined();
    expect(mgr.getTools()).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid tool schema'));
    warnSpy.mockRestore();
    mgr.destroy();
  });

  it('MCP-005: omite herramientas duplicadas y conserva la primera', async () => {
    mockReaddirSync.mockReturnValue(['primero.json', 'segundo.json']);
    mockReadFileSync.mockReturnValueOnce(crearToolJson('tool-dup', 'Version primera')).mockReturnValueOnce(crearToolJson('tool-dup', 'Version segunda'));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mgr.getTool('tool-dup')?.description).toBe('Version primera');
    expect(mgr.getTools()).toHaveLength(1);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ignored because it is already provided by'));
    logSpy.mockRestore();
    mgr.destroy();
  });

  it('MCP-006: getTool devuelve la herramienta por nombre', async () => {
    mockReaddirSync.mockReturnValue(['alfa.json', 'beta.json']);
    mockReadFileSync.mockReturnValueOnce(crearToolJson('tool-alfa')).mockReturnValueOnce(crearToolJson('tool-beta'));
    const mgr = new MCPManager('/tmp/tools-test');
    await mgr.initialize();
    expect(mgr.getTool('tool-alfa')?.name).toBe('tool-alfa');
    expect(mgr.getTool('tool-alfa')?.inputSchema).toBeDefined();
    mgr.destroy();
  });
});
