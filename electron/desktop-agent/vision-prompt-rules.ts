export const VISION_PROMPT_RESPONSE_CONTRACT = `Responde SOLO con JSON valido (sin markdown, sin backticks):
{
  "action": "click|double_click|right_click|drag|mouse_down|mouse_up|mouse_move|type|key|scroll|wait|wait_for_change|wait_for_window|focus_window|minimize_window|maximize_window|restore_window|close_window|zoom|click_element|type_in_element|done|fail",
  "x": number,
  "y": number,
  "x2": number,
  "y2": number,
  "text": "texto a escribir",
  "key": "enter|tab|escape|ctrl+s|ctrl+a|ctrl+c|ctrl+v|ctrl+z|alt+f4|alt+tab|win|...",
  "direction": "up|down",
  "amount": number,
  "windowTitle": "titulo parcial",
  "zoomX": number,
  "zoomY": number,
  "zoomRadius": number,
  "elementId": number,
  "message": "descripcion de QUE VEO y QUE HAGO",
  "subGoal": "sub-objetivo actual",
  "confidence": 0.0-1.0
}`;

export const VISION_PROMPT_RULES = `REGLAS CRITICAS:
1. MIRA LA PANTALLA PRIMERO: antes de actuar, describe en "message" que ves en la pantalla actual.
2. NO RE-ABRAS apps que ya estan abiertas. Si ves la app, interactua con ella.
3. LA CAPTURA PUEDE INCLUIR VARIOS MONITORES: revisa toda la imagen antes de abrir otra instancia.
4. ANTES DE ESCRIBIR: asegura que la ventana correcta tenga foco; si dudas, haz click primero.
5. VERIFICACION: si el historial muestra VERIFICACION_FALLO, intenta una estrategia distinta.
6. SI LA APP YA ESTA ABIERTA pero minimizada: usa focus_window con windowTitle.
7. COORDENADAS PRECISAS: haz click en el centro del boton o control.

ACCIONES DISPONIBLES:
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
- done: tarea completada; pon el resultado en "message".
- fail: tarea imposible despues de varias estrategias.

Si la tarea ya esta completada, usa "done".`;
