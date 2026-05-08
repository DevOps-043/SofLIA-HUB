import { objectParams, stringProp } from './schema';
import type { GeminiFunctionDeclaration, GeminiToolGroup } from './types';

export const WHATSAPP_SEND_FILE_TOOL: GeminiFunctionDeclaration = {
  name: 'whatsapp_send_file',
  description: 'Envia un archivo de la computadora al usuario por WhatsApp.',
  parameters: objectParams({
    file_path: stringProp('Ruta completa del archivo a enviar.'),
    caption: stringProp('Texto opcional del archivo.'),
  }, ['file_path']),
};

export const NATIVE_AI_TOOLS: GeminiToolGroup = {
  functionDeclarations: [
    {
      name: 'generate_image',
      description: 'Genera una imagen con IA a partir de una descripcion en texto.',
      parameters: objectParams({
        prompt: stringProp('Descripcion detallada en ingles de la imagen deseada.'),
      }, ['prompt']),
    },
  ],
};
