export const PROCESS_TOOLS = [
  {
    name: 'get_system_info',
    description: 'Obtiene informacion del sistema: SO, CPU, RAM, disco, y las rutas del escritorio, documentos y descargas del usuario.',
    parameters: { type: 'OBJECT' as const, properties: {} },
  },
  {
    name: 'list_processes',
    description: 'Lista los procesos activos de la computadora con su nombre, PID, uso de CPU y memoria. Usa esto cuando el usuario pregunte que programas estan abiertos o que esta consumiendo recursos.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        sort_by: { type: 'STRING' as const, description: 'Ordenar por: "cpu", "memory" o "name". Por defecto "memory".' },
        top: { type: 'NUMBER' as const, description: 'Cantidad de procesos a mostrar. Por defecto 15.' },
      },
    },
  },
  {
    name: 'kill_process',
    description: 'Cierra/termina un proceso de la computadora por su nombre o PID. REQUIERE confirmacion del usuario. Usa esto cuando el usuario pida cerrar un programa, matar un proceso, o forzar el cierre de algo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        pid: { type: 'NUMBER' as const, description: 'ID del proceso a cerrar. Usa list_processes para obtener el PID.' },
        name: { type: 'STRING' as const, description: 'Nombre del proceso (ej: "chrome", "notepad"). Si se da nombre, cierra TODAS las instancias.' },
      },
    },
  },
  {
    name: 'open_application',
    description: 'Abre una aplicacion o archivo. Acepta ruta completa o nombre comun de la app (por ejemplo "AnyDesk", "Excel", "Chrome"). En Windows intenta resolver ejecutables instalados, accesos directos y alias del sistema. REQUIERE confirmacion.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta completa o nombre comun de la aplicacion o archivo a abrir.' },
      },
      required: ['path'],
    },
  },
];
