import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Valida si un tipo MIME está soportado por la API de Gemini Multimodal.
 */
function isSupportedAudioMimeType(mimeType: string): boolean {
  const supportedTypes = [
    'audio/ogg',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
    'audio/aac',
    'audio/flac',
    'audio/m4a',
    'audio/mp4',
    'audio/webm',
    'audio/x-m4a'
  ];
  return supportedTypes.includes(mimeType);
}

/**
 * Procesa un mensaje de audio de WhatsApp utilizando la API Multimodal nativa de Gemini.
 * Convierte el audio a base64, lo envía a Gemini-1.5-flash y extrae la intención del comando.
 * 
 * @param buffer Buffer de audio (generalmente .ogg desde WhatsApp)
 * @param mimeType Tipo MIME del audio (por defecto 'audio/ogg')
 * @returns El texto extraído con la intención del comando, o cadena vacía si falla.
 */
export async function processAudioMessage(buffer: Buffer, mimeType: string = 'audio/ogg'): Promise<string> {
  const MAX_RETRIES = 2;

  if (!buffer || buffer.length === 0) {
    console.warn('[AudioProcessor] Se recibió un buffer vacío.');
    return '';
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[AudioProcessor] No se encontró GEMINI_API_KEY en las variables de entorno.');
    return '';
  }

  // Normalizar el mimeType si viene con sufijos extraños
  const cleanMimeType = mimeType.split(';')[0].trim().toLowerCase();
  
  if (!isSupportedAudioMimeType(cleanMimeType)) {
    console.warn(`[AudioProcessor] Tipo MIME no soportado de forma nativa: ${cleanMimeType}. Se intentará procesar de todos modos.`);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Inicializar el modelo con las instrucciones del sistema requeridas
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: 'Transcribe el audio y extrae la intención del comando como si el usuario lo hubiera escrito textualmente. Responde SOLO con el comando extraído.'
  });

  // 1. Convertir el Buffer de audio (.ogg de WhatsApp) a base64.
  const base64Audio = buffer.toString('base64');

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      // 2. Formatear el payload para la API Multimodal de Gemini incluyendo el base64 inlineData.
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: cleanMimeType,
            data: base64Audio
          }
        }
      ]);

      // 3. Obtener la respuesta y retornarla
      const extractedText = result.response.text().trim();

      if (!extractedText) {
        console.warn('[AudioProcessor] El audio resultó ser ininteligible o vacío tras el procesamiento.');
        return ''; // Aviso silencioso
      }

      console.log(`[AudioProcessor] Intención extraída exitosamente: "${extractedText.substring(0, 50)}${extractedText.length > 50 ? '...' : ''}"`);
      return extractedText;
      
    } catch (error: any) {
      attempt++;
      const errorMessage = error.message || 'Error desconocido';
      console.error(`[AudioProcessor] Error procesando audio multimodal (intento ${attempt}/${MAX_RETRIES}):`, errorMessage);
      
      // Si fue un error de red o límite de API, reintentamos con backoff
      if (attempt < MAX_RETRIES && (errorMessage.includes('fetch') || errorMessage.includes('503') || errorMessage.includes('429'))) {
        const delay = attempt * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Si fallan los reintentos o es un error irrecuperable
      break;
    }
  }

  // 6. Retornar un aviso silencioso (cadena vacía) en caso de fallo absoluto
  return '';
}
