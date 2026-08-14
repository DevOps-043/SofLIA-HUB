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
  const explicitVisualReference = hasExplicitVisualReference(text) || hasVideoSceneReference(text);
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

/**
 * Referencias a la escena de un video que no usan ningun verbo visual.
 *
 * "¿Que trae puesto?", "¿quien sale ahi?" o "¿que esta pasando?" son
 * exactamente las preguntas que un usuario hace mirando un video, y ninguna
 * encaja en `hasExplicitVisualReference`. Sin este caso, el turno respondia que
 * no tenia acceso a la imagen teniendo la pestaña delante.
 */
export function hasVideoSceneReference(text: string): boolean {
  const namesVideo = /\b(video|clip|pelicula|serie|escena|reproduccion|reproduciendo|fotograma|frame|minuto|segundo)\b/.test(text);
  const asksAboutScene = /\b(que (esta )?(pasa|pasando|sucede|ocurre|hace|hacen|dice|dicen|muestra|muestran|aparece|aparecen|sale|salen)|quien (es|sale|aparece|habla)|de que (habla|trata)|que trae puesto|como (es|se ve)|cuantos?|donde (esta|estan))\b/.test(text);
  return namesVideo || asksAboutScene;
}

function hasExplicitVisualReference(text: string): boolean {
  const hasVisualVerb = /\b(ver|ves|viendo|mira|mirar|observa|observar|revisa|revisar|muestra|mostrando)\b/.test(text);
  const hasCurrentSurface = /\b(lo que|esto|aqui|ahora|pantalla|pagina|pestana|navegador|browser|sitio|vista|mostrando|viendo)\b/.test(text);
  return hasVisualVerb && hasCurrentSurface;
}
