import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeRemoteNodeTool } from '../../services/computer-use/remote-tools';

afterEach(() => vi.unstubAllGlobals());
const cases = [
  { tool: 'run_background_command_on_node', method: 'runBackgroundCommand', args: { node_id: 'node-1', command: '\n comando ficticio\n', working_directory: 'carpeta', title: 'Prueba' }, expected: ['node-1', { command: '\n comando ficticio\n', working_directory: 'carpeta', title: 'Prueba' }] },
  { tool: 'use_computer_on_node', method: 'executeTask', args: { node_id: 'node-1', task: 'Tarea', backend: 'browser', max_steps: 5 }, expected: ['node-1', { task: 'Tarea', backend: 'browser', max_steps: 5 }] },
  { tool: 'take_screenshot_on_node', method: 'takeScreenshot', args: { node_id: 'node-1', display_id: 'pantalla' }, expected: ['node-1', { display_id: 'pantalla' }] },
  { tool: 'poll_remote_node_process_session', method: 'pollProcessSession', args: { node_id: 'node-1', session_id: 'sesión ficticia' }, expected: ['node-1', 'sesión ficticia'] },
  { tool: 'kill_remote_node_process_session', method: 'killProcessSession', args: { node_id: 'node-1', session_id: 'sesión ficticia' }, expected: ['node-1', 'sesión ficticia'] },
  { tool: 'open_application_on_node', method: 'openApplication', args: { node_id: 'node-1', path: 'calculadora' }, expected: ['node-1', { path: 'calculadora' }] },
] as const;
describe('Proyección y validación renderer de herramientas remotas', () => {
  it.each(cases)('proyecta $tool sin reenviar node_id al objeto de argumentos', async item => {
    const operation = vi.fn().mockResolvedValue({ success: true });
    vi.stubGlobal('window', { remoteNode: { [item.method]: operation } });
    expect(await executeRemoteNodeTool(item.tool, item.args)).toEqual({ success: true });
    const [id, options] = operation.mock.calls[0];
    expect(id).toBe('node-1');
    if (typeof item.expected[1] === 'string') expect(options).toBe(item.expected[1]);
    else { expect(options).toMatchObject(item.expected[1]); expect(options).not.toHaveProperty('node_id'); }
  });
  it.each([
    ['run_background_command_on_node', { node_id: 'node-1', command: 42 }],
    ['use_computer_on_node', { node_id: 'node-1', task: 'Tarea', max_steps: -1 }],
    ['take_screenshot_on_node', { node_id: 'node-1', display_id: 42 }],
    ['open_application_on_node', { node_id: 'NODE INVÁLIDO', path: 'calculadora' }],
    ['configure_remote_node_host', { port: 65536 }],
    ['register_remote_node', { name: 'Nodo', base_url: 'file:///privado', token: 'ficticio' }],
  ] as const)('rechaza antes de invocar el puente: %s', async (tool, args) => {
    const operation = vi.fn();
    vi.stubGlobal('window', { remoteNode: { runBackgroundCommand: operation, executeTask: operation, takeScreenshot: operation, openApplication: operation, updateHostConfig: operation, registerNode: operation } });
    await expect(executeRemoteNodeTool(tool, args)).rejects.toThrow('Los datos de nodo remoto no son válidos');
    expect(operation).not.toHaveBeenCalled();
  });
});
