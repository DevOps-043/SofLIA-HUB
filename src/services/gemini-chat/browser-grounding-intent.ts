export type BrowserGroundingIntent = 'none' | 'read-current' | 'follow-resource';

/**
 * Reconoce referencias a la superficie visible aunque el usuario no diga
 * "mira la pantalla". La clasificación solo decide si hay que adjuntar o
 * ampliar evidencia; nunca concede autorización para mutar la página.
 */
export function classifyBrowserGroundingIntent(message: string): BrowserGroundingIntent {
  const text = normalizeBrowserGroundingText(message);
  const explicitVisualReference = hasExplicitVisualReference(text);
  const deicticReference = /\b(esto|eso|aqui|esta pagina|este sitio|este chat|este correo|este mensaje|ese enlace|ese link|el de arriba|lo de arriba)\b/.test(text);
  const sharedBySomeone = /\bque\b.{0,80}\b(?:me\s+)?(?:mando|mandaron|envio|enviaron|compartio|compartieron|paso|pasaron|escribio|escribieron|dijo|dijeron|recomendo|recomendaron|dejo|dejaron)\b/.test(text);
  const currentConversation = /\b(chat|correo|email|mensaje|conversacion)\b.{0,50}\b(abierto|abierta|visible|mostrando|viendo)\b/.test(text);

  if (!explicitVisualReference && !deicticReference && !sharedBySomeone && !currentConversation) {
    return 'none';
  }

  const linkedResource = /\b(repositorio|repo|enlace|link|archivo|documento|presentacion|hoja|video|articulo|sitio|pagina web)\b/.test(text);
  const contentRequest = /\b(resumen|resume|resumir|analiza|analizar|revisa|revisar|lee|leer|investiga|investigar|explica|explicar|contenido|de que trata)\b/.test(text);
  return linkedResource && contentRequest ? 'follow-resource' : 'read-current';
}

export function normalizeBrowserGroundingText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasExplicitVisualReference(text: string): boolean {
  const hasVisualVerb = /\b(ver|ves|viendo|mira|mirar|observa|observar|revisa|revisar|muestra|mostrando)\b/.test(text);
  const hasCurrentSurface = /\b(lo que|esto|aqui|ahora|pantalla|pagina|pestana|navegador|browser|sitio|vista|mostrando|viendo)\b/.test(text);
  return hasVisualVerb && hasCurrentSurface;
}
