export type BrowserGroundingIntent = 'none' | 'read-current' | 'follow-resource';

/**
 * Reconoce referencias a la superficie visible aunque el usuario no diga
 * "mira la pantalla". La clasificación solo decide si hay que adjuntar o
 * ampliar evidencia; nunca concede autorización para mutar la página.
 */
export function classifyBrowserGroundingIntent(message: string): BrowserGroundingIntent {
  const text = normalizeBrowserGroundingText(message);
  const namesDesktopSurface = /\b(codex|escritorio|desktop|otra ventana|aplicacion de escritorio|programa abierto)\b/.test(text);
  const namesBrowserSurface = /\b(navegador|browser|pagina|pestana|sitio|chat abierto|correo abierto|mensaje abierto)\b/.test(text);
  // "Mira lo que hace Codex" describe una superficie externa. Adjuntar el DOM
  // de la pestaña activa contaminaria la evidencia antes de elegir desktop.
  if (namesDesktopSurface && !namesBrowserSurface) return 'none';
  const explicitVisualReference = hasExplicitVisualReference(text);
  const deicticReference = /\b(esto|eso|aqui|esta pagina|este sitio|este chat|este correo|este mensaje|ese enlace|ese link|el de arriba|lo de arriba)\b/.test(text);
  const sharedBySomeone = /\bque\b.{0,80}\b(?:me\s+)?(?:mando|mandaron|envio|enviaron|compartio|compartieron|paso|pasaron|escribio|escribieron|dijo|dijeron|recomendo|recomendaron|dejo|dejaron)\b/.test(text);
  const currentConversation = /\b(chat|correo|email|mensaje|conversacion)\b.{0,50}\b(abierto|abierta|visible|mostrando|viendo)\b/.test(text);
  const contentRequest = /\b(resumen|resume|resumir|analiza|analizar|revisa|revisar|lee|leer|investiga|investigar|explica|explicar|contenido|de que trata)\b/.test(text);

  if (contentRequest && (hasActiveDocumentReference(text) || hasFollowingSurfaceReference(text))) return 'read-current';

  if (!explicitVisualReference && !deicticReference && !sharedBySomeone && !currentConversation) {
    return 'none';
  }

  const linkedResource = /\b(repositorio|repo|enlace|link|archivo|documento|presentacion|hoja|video|articulo|sitio|pagina web)\b/.test(text);
  return linkedResource && contentRequest ? 'follow-resource' : 'read-current';
}

/** Referencia inequívoca al documento que el usuario tiene delante. */
export function isActiveDocumentContentRequest(message: string): boolean {
  const text = normalizeBrowserGroundingText(message);
  return hasActiveDocumentReference(text)
    && /\b(resumen|resume|resumir|analiza|analizar|revisa|revisar|lee|leer|explica|explicar|contenido|de que trata)\b/.test(text);
}

/**
 * Pide comprender completa la conversación o página que el usuario tiene
 * delante ("resume el siguiente chat", "analiza esta página"). La observación
 * normal sólo ve el viewport; un resumen necesita la extracción documental de
 * toda la pestaña. Sólo aplica con el navegador visible: si la lectura falla,
 * el turno conserva la observación ordinaria.
 */
export function isVisiblePageContentRequest(message: string): boolean {
  const text = normalizeBrowserGroundingText(message);
  if (!/\b(resumen|resume|resumir|resumelo|resumela|analiza|analizar|analisis|explica|explicar|opinion|de que trata)\b/.test(text)) return false;
  return hasFollowingSurfaceReference(text)
    || /\b(?:este|ese) (?:chat|hilo|articulo)\b|\b(?:esta|esa) (?:pagina|pestana|publicacion)\b/.test(text)
    || /\b(chat|conversacion|hilo|pagina|pestana|articulo)\b.{0,50}\b(abierto|abierta|actual|visible)\b/.test(text);
}

export function normalizeBrowserGroundingText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasExplicitVisualReference(text: string): boolean {
  const hasVisualVerb = /\b(ver|ves|viendo|mira|mirar|observa|observar|revisa|revisar|muestra|mostrando)\b/.test(text);
  const hasCurrentSurface = /\b(lo que|esto|aqui|ahora|pantalla|pagina|pestana|navegador|browser|sitio|vista|mostrando|viendo)\b/.test(text);
  return hasVisualVerb && hasCurrentSurface;
}

/**
 * "El siguiente chat" sin el chat pegado en el mensaje sólo puede referirse a
 * lo que está en pantalla. Si el mensaje ya trae contenido extenso, la
 * referencia apunta a ese texto pegado y no a la pestaña.
 */
const MAX_REFERENCE_ONLY_MESSAGE_CHARS = 400;

function hasFollowingSurfaceReference(text: string): boolean {
  return text.length <= MAX_REFERENCE_ONLY_MESSAGE_CHARS
    && /\b(?:siguiente|presente)\s+(?:chat|conversacion|hilo|correo|email|mensaje|pagina|articulo|publicacion)\b/.test(text);
}

function hasActiveDocumentReference(text: string): boolean {
  return /\b(?:el|del|este|ese|aquel) documento\b/.test(text)
    || /\bdocumento\s+(?:abierto|visible|actual)\b/.test(text);
}
