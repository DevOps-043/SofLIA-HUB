import type { ImageGenerationReply } from '../../src/shared/image-generation';
import { jsonObject } from '../../src/shared/grounded-generation';

const MAX_IMAGE_BASE64 = 16 * 1024 * 1024;
/** La proyección sólo devuelve una imagen PNG acotada generada por el proveedor. */
export function projectImageResponse(raw: unknown): ImageGenerationReply {
  if (!jsonObject(raw) || !Array.isArray(raw.data) || raw.data.length !== 1 || !jsonObject(raw.data[0])) {
    throw new Error('Respuesta de imagen no válida.');
  }
  const data = raw.data[0].b64_json;
  if (typeof data !== 'string' || !data.length || data.length % 4 !== 0 || data.length > MAX_IMAGE_BASE64
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Imagen no válida.');
  return { success: true, text: 'Aquí está tu imagen generada.', imageData: `data:image/png;base64,${data}` };
}
