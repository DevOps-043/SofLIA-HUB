import type { GoogleToolDeclaration } from './types';

export const DRIVE_TOOLS: GoogleToolDeclaration[] = [
  {
    name: 'drive_list_files',
    description: 'Lista archivos de Google Drive, opcionalmente por carpeta.',
    parameters: {
      type: 'OBJECT',
      properties: {
        folder_id: { type: 'STRING', description: 'ID de carpeta. Si falta, lista la raiz.' },
        max_results: { type: 'NUMBER', description: 'Maximo de archivos. Default 20.' },
      },
    },
  },
  {
    name: 'drive_search',
    description: 'Busca archivos en Drive por nombre y contenido usando palabras clave cortas.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Texto a buscar.' } }, required: ['query'] },
  },
  {
    name: 'drive_download',
    description: 'Descarga un archivo de Drive. Docs/Sheets/Slides pueden exportarse como texto o PDF/XLSX.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_id: { type: 'STRING', description: 'ID del archivo.' },
        file_name: { type: 'STRING', description: 'Nombre local destino.' },
        format: { type: 'STRING', description: 'text por defecto o pdf para envio.' },
      },
      required: ['file_id', 'file_name'],
    },
  },
  {
    name: 'drive_upload',
    description: 'Sube un archivo local a Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        file_path: { type: 'STRING', description: 'Ruta local.' },
        folder_id: { type: 'STRING', description: 'ID carpeta destino.' },
        name: { type: 'STRING', description: 'Nombre en Drive.' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'drive_create_folder',
    description: 'Crea una carpeta en Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nombre de carpeta.' },
        parent_id: { type: 'STRING', description: 'ID carpeta padre.' },
      },
      required: ['name'],
    },
  },
];
