export const BASIC_FILE_TOOLS = [
  {
    name: 'list_directory',
    description: 'Lista todos los archivos y carpetas en un directorio del sistema del usuario.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del directorio a listar.' },
        show_hidden: { type: 'BOOLEAN' as const, description: 'Si es true, muestra archivos ocultos.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Lee el contenido de un archivo. Ademas de texto plano, lee PDF, Excel (.xlsx), PowerPoint (.pptx) y Word (.docx): los convierte a Markdown e incluye las TABLAS estructuradas. No hace falta subir el archivo a la nube.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta completa del archivo.' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Crea o sobrescribe un archivo con contenido de texto.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        path: { type: 'STRING' as const, description: 'Ruta del archivo.' },
        content: { type: 'STRING' as const, description: 'Contenido a escribir.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: 'Crea una carpeta nueva.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta de la carpeta.' } },
      required: ['path'],
    },
  },
  {
    name: 'move_item',
    description: 'Mueve o renombra un archivo o carpeta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_path: { type: 'STRING' as const, description: 'Ruta actual.' },
        destination_path: { type: 'STRING' as const, description: 'Nueva ruta.' },
      },
      required: ['source_path', 'destination_path'],
    },
  },
  {
    name: 'copy_item',
    description: 'Copia un archivo o carpeta.',
    parameters: {
      type: 'OBJECT' as const,
      properties: {
        source_path: { type: 'STRING' as const, description: 'Ruta origen.' },
        destination_path: { type: 'STRING' as const, description: 'Ruta destino.' },
      },
      required: ['source_path', 'destination_path'],
    },
  },
  {
    name: 'delete_item',
    description: 'Envia un archivo o carpeta a la papelera. REQUIERE confirmacion del usuario via WhatsApp.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta a eliminar.' } },
      required: ['path'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Obtiene informacion de un archivo: tamano, fechas, tipo.',
    parameters: {
      type: 'OBJECT' as const,
      properties: { path: { type: 'STRING' as const, description: 'Ruta del archivo.' } },
      required: ['path'],
    },
  },
];
