import { numberProp, objectParams, stringProp } from './schema';
import type { GeminiFunctionDeclaration } from './types';

export const DRIVE_TOOL_DECLARATIONS: GeminiFunctionDeclaration[] = [
  { name: 'drive_list_files', description: 'Lista los archivos recientes en Google Drive.', parameters: objectParams({ query: stringProp('Busqueda de Drive. Opcional.'), max_results: numberProp('Numero maximo de archivos. Opcional.') }) },
  { name: 'drive_search', description: 'Busca archivos en Google Drive por nombre o texto relevante.', parameters: objectParams({ query: stringProp('Texto de busqueda.') }, ['query']) },
  { name: 'drive_download', description: 'Descarga un archivo de Google Drive a una ruta local.', parameters: objectParams({ file_id: stringProp('ID del archivo en Drive.'), destination_path: stringProp('Ruta local destino.'), format: stringProp('Opcional: text o pdf.') }, ['file_id', 'destination_path']) },
  { name: 'drive_upload', description: 'Sube un archivo local a Google Drive.', parameters: objectParams({ file_path: stringProp('Ruta local del archivo.'), folder_id: stringProp('ID opcional de carpeta destino.'), name: stringProp('Nombre opcional del archivo en Drive.') }, ['file_path']) },
  { name: 'drive_create_folder', description: 'Crea una carpeta en Google Drive.', parameters: objectParams({ name: stringProp('Nombre de la carpeta.'), parent_id: stringProp('ID opcional de carpeta padre.') }, ['name']) },
];
