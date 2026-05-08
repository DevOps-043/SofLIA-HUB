export { executeToolDirect } from './computer-use/tool-dispatch';
export { registerComputerUseHandlers } from './computer-use/ipc-registration';

export const SYSTEM_PROCESS_TOOLS: any[] = [
  {
    name: 'list_screens',
    description: 'Lista todas las pantallas (monitores) disponibles, devolviendo su id, name y display_id. Esto permite saber que display_id pasar a take_screenshot.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_processes',
    description: 'Obtiene una lista de los 20 procesos que mas CPU consumen en el sistema. Retorna pid, name, cpu, mem, command.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'kill_process',
    description: 'Termina (mata) un proceso del sistema usando su PID.',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'El ID del proceso (PID) a terminar.' },
      },
      required: ['pid'],
    },
  },
];
