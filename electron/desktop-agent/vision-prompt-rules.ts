import { DESKTOP_ACTIONS } from './action-types';

const ACTION_CONTRACT = DESKTOP_ACTIONS.join('|');

export const VISION_PROMPT_RESPONSE_CONTRACT = `Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "action": "${ACTION_CONTRACT}",
  "x": number,
  "y": number,
  "x2": number,
  "y2": number,
  "text": "texto a escribir",
  "key": "enter|tab|escape|ctrl+s|ctrl+a|ctrl+c|ctrl+v|ctrl+z|alt+f4|alt+tab|win|...",
  "direction": "up|down",
  "amount": number,
  "windowTitle": "titulo parcial",
  "appName": "nombre de la aplicacion para open_application",
  "url": "URL completa para open_url",
  "elementName": "texto visible del elemento para click_element_by_name",
  "zoomX": number,
  "zoomY": number,
  "zoomRadius": number,
  "elementId": number,
  "message": "descripcion de QUE VEO y QUE HAGO",
  "subGoal": "sub-objetivo actual",
  "confidence": 0.0-1.0
}`;

const DETERMINISTIC_FIRST_RULE = `0. ACCIONES DETERMINISTAS PRIMERO: para abrir una aplicacion usa open_application con "appName" (el sistema la localiza y lanza por ti); para abrir un sitio web usa open_url con la URL completa. NUNCA busques iconos en la barra de tareas ni en el menu inicio con clicks: el click visual es el ULTIMO recurso.`;

const BASE_RULES = `1. MIRA LA PANTALLA PRIMERO: antes de actuar, describe en "message" que ves en la pantalla actual.
2. NO RE-ABRAS ni re-enfoques repetidamente una ventana que YA VES en pantalla: si la ves, actua directamente sobre ella. Solo usa open_application/focus_window si NO la ves (revisa CONTEXTO DEL EQUIPO).
3. LA CAPTURA PUEDE INCLUIR VARIOS MONITORES: revisa toda la imagen antes de abrir otra instancia.
4. ANTES DE ESCRIBIR: asegura que la ventana correcta tenga foco; si dudas, haz click primero.
5. VERIFICACION: si el historial muestra VERIFICACION_FALLO, intenta una estrategia distinta.
6. SI LA APP YA ESTA ABIERTA pero minimizada: usa focus_window con windowTitle.
7. SET-OF-MARKS PRIMERO: si ves marcadores [N] sobre botones, campos, iconos o controles, usa click_element/type_in_element con elementId. Un marcador [N] es clickeable AUNQUE no tenga texto (los iconos/controles detectados por vision no traen nombre). Si tu objetivo tiene un [N] encima, DEBES usar click_element con ese id — NUNCA un click por coordenadas sobre un punto que ya tiene marcador.
8. CLICK POR TEXTO COMO FALLBACK: si no hay marcador claro y el objetivo tiene texto legible, usa click_element_by_name con ese texto Y con "x","y" de donde lo ves en la imagen principal. El sistema usa esa pista para rechazar textos iguales que esten lejos.
9. SI click_element_by_name NO ENCONTRO EL TEXTO, el texto no es legible tal cual (boton dibujado o estilizado): usa el MARCADOR [N] mas cercano a tu objetivo, o haz zoom sobre el boton y luego clickea. NO repitas la misma busqueda identica ni insistas con el mismo texto.
10. COORDENADAS PRECISAS: si debes usar coordenadas, haz click en el centro del boton o control. Si un click con coordenadas no tuvo efecto (la pantalla no cambio), usa zoom para inspeccionar y ajustar antes de reintentar; NO repitas la misma coordenada exacta mas de una vez.
11. LA IMAGEN ZOOM ES SOLO OBSERVACION: cuando exista una segunda imagen de ZOOM, sirve UNICAMENTE para ver mejor; NUNCA tomes coordenadas x/y de ella. TODAS las coordenadas (x, y, x2, y2, zoomX, zoomY) van SIEMPRE en el espacio de la imagen PRINCIPAL. Tras hacer zoom, ubica el objetivo en la imagen principal y clickea ahi.`;

const BASE_ACTIONS = `ACCIONES DISPONIBLES:
- click/double_click/right_click: mouse en coordenadas (x,y).
- drag: arrastrar de (x,y) a (x2,y2).
- type: escribir texto; requiere foco en la ventana correcta.
- key: tecla o combo (enter, tab, escape, ctrl+s, alt+f4, alt+tab, win, etc.).
- scroll: usar "direction" y "amount".
- focus_window: traer ventana al frente con parte del titulo.
- minimize_window/maximize_window/restore_window/close_window: gestion de ventanas.
- zoom: inspeccionar region ampliada con zoomX, zoomY, zoomRadius.
- click_element: click preciso en marcador [N] en modo Set-of-Marks.
- type_in_element: click y escritura en campo marcado [N].
- click_element_by_name: click preciso POR TEXTO VISIBLE con "elementName" en CUALQUIER app (nativa, Chromium, Java, terminal); mide la posicion con accesibilidad u OCR. INCLUYE SIEMPRE "x" e "y" con la posicion aproximada donde VES el elemento en la imagen: si el mismo texto aparece varias veces (p.ej. el nombre en un logo y en una pestaña), la coordenada indica cual quieres. Con "amount": 2 hace doble click.
- done: tarea completada; pon el resultado en "message".
- fail: tarea imposible despues de varias estrategias.`;

const DETERMINISTIC_ACTIONS = `- open_application: lanza (o enfoca) una aplicacion instalada por nombre con "appName"; verifica que la ventana aparezca.
- open_url: abre una URL en el navegador predeterminado con "url".`;

const DONE_CONTRACT = `Usa "done" SOLO cuando el objetivo COMPLETO de la TAREA sea visible en pantalla.
Abrir una app o pagina NO completa una tarea que pide algo mas: si la tarea dice "reproduce X", done requiere que X este reproduciendose; si dice "envia Y", done requiere la confirmacion de envio. Ante la duda, ejecuta el paso faltante en lugar de terminar.`;

export function buildVisionPromptRules(deterministicFirst: boolean): string {
  const rules = deterministicFirst ? `${DETERMINISTIC_FIRST_RULE}\n${BASE_RULES}` : BASE_RULES;
  const actions = deterministicFirst ? `${BASE_ACTIONS}\n${DETERMINISTIC_ACTIONS}` : BASE_ACTIONS;
  return `REGLAS CRITICAS:\n${rules}\n\n${actions}\n\n${DONE_CONTRACT}`;
}

/** Compatibilidad con consumidores existentes: reglas sin modo determinista. */
export const VISION_PROMPT_RULES = buildVisionPromptRules(false);
