import type { ComputerUseApi } from '../../shared/computer-use';
import type { DesktopAgentApi, DesktopAgentConfig } from '../../shared/desktop-agent';
import type { RemoteNodeApi } from '../../shared/remote-node';

/** Fixture sólo de compilación: esta función nunca ejecuta herramientas. */
export async function assertAutomationContracts(computer: ComputerUseApi, desktop: DesktopAgentApi, remote: RemoteNodeApi) {
  const config: DesktopAgentConfig = await desktop.getConfig();
  const status = await desktop.getStatus();
  const maxSteps: number = config.maxSteps;
  const task: string | null = status.currentTask;
  void maxSteps; void task;
  await desktop.executeTask('Tarea QA', { backend: 'browser', browserIsolated: true });
  await remote.registerNode({ name: 'Nodo QA', base_url: 'https://nodo.example.invalid', token: 'token-ficticio' });
  // @ts-expect-error Las rutas públicas son texto, no números.
  await computer.readFile(42);
  // @ts-expect-error La configuración no admite números escritos como texto.
  await desktop.setConfig({ maxSteps: '10' });
  // @ts-expect-error AbortSignal es interno de main, no un payload IPC.
  await desktop.executeTask('Tarea QA', { signal: new AbortController().signal });
  // @ts-expect-error La dirección de scroll conserva las primitivas soportadas.
  await desktop.scroll('lateral');
  // @ts-expect-error El registro exige credencial y destino explícitos.
  await remote.registerNode({ name: 'Nodo incompleto' });
  // @ts-expect-error La rotación de credencial es booleana.
  await remote.updateHostConfig({ rotate_token: 'sí' });
  const reply = await computer.readFile('archivo-qa.txt');
  // @ts-expect-error Un resultado dinámico debe comprobarse antes de tratarlo como string.
  const unchecked: string = reply.content;
  void unchecked;
  if (typeof reply.content === 'string') { const checked: string = reply.content; void checked; }
}
