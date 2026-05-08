import type { SpeechRecognitionConstructor } from './types';

export function joinTranscript(...segments: Array<string | null | undefined>) {
  return segments
    .map((segment) => (segment || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const flowWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return flowWindow.SpeechRecognition || flowWindow.webkitSpeechRecognition || null;
}

export function getSupportedAudioMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

export function shouldHandleAsAssistant(rawText: string) {
  const text = rawText.trim().toLowerCase();
  if (!text) return false;

  const commandStarts = /^(?:abre|abrir|busca|buscar|entra|entrar|ve a|ir a|navega|navegar|selecciona|seleccionar|haz|hacer|mueve|desplazate|desplázate|cierra|cerrar|responde|explica|analiza|resume|redacta|traduce|consulta|revisa|compara|organiza|crea|crear|envia|envía|manda)\b/;
  const uiOrSystemTerms = /\b(chatgpt|gmail|outlook|chrome|edge|whatsapp|google|youtube|calendario|conversacion|conversación|chat|ventana|pestana|pestaña|pagina|página|sitio|app|aplicacion|aplicación|carpeta|archivo)\b/;
  const compoundAction = /\b(y|luego|despues|después)\b/;

  return commandStarts.test(text) || (uiOrSystemTerms.test(text) && compoundAction.test(text));
}
