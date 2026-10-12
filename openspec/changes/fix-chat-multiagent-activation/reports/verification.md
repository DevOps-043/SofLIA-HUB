# Verificación de activación multiagente en chat

Fecha: 2026-10-11. Estado: arreglo y seguimiento visual verificados en chat real;
compuerta general final aprobada.

## Diagnóstico confirmado

- El selector original no reconocía «usa los multiagentes para que cada uno
  proponga algo diferente». El chat real negaba disponibilidad y no creaba equipo.
- Los especialistas no recibían el encargo previo del mismo chat.
- Con razonamiento Máximo y límite de 1500 tokens, ambos workers OpenAI
  devolvieron `incomplete`, `max_output_tokens`, cero caracteres de texto y
  1500 tokens de razonamiento cada uno.
- El chat publicaba con `dataUserId` de Lia; main exige la identidad SOFIA. Las
  publicaciones reales se rechazaban y el monitor quedaba vacío.

## Corrección

Selección natural afirmativa con exclusiones, citas y prefijos; perspectivas
práctica/creativa para alternativas; seis mensajes del mismo chat dentro de
8000 caracteres serializados y del presupuesto total; estado real para el
coordinador aun sin aportes; razonamiento bajo de workers y preferencia original
del coordinador; identidad SOFIA separada para actividad. Memoria y cuota
conservan su propietario anterior. No se modifican handlers IPC ni permisos.

## Prueba nativa de chat

En Electron de desarrollo se creó un chat de prueba con una activación breve
para Rethink & Delight. Se envió la misma frase de la captura y se contrastaron
las respuestas reales del proveedor con la publicación IPC y el DOM del panel.
Tras recargar los módulos actualizados, ambos especialistas completaron:

| Worker | Razonamiento | Estado | Texto | Tokens de razonamiento |
|---|---|---|---:|---:|
| Primero | low | completed | 1081 caracteres | 152 |
| Segundo | low | completed | 1473 caracteres | 183 |

El panel mostró dos roles completados, `2/2`, y 5.9 segundos observados.
Las cuatro publicaciones IPC fueron aceptadas. El coordinador mantuvo Máximo y
presentó «Ingrediente protagonista» y «Etiqueta del futuro» desde los aportes.
Los datos sin texto del chat ni identificadores personales se conservan en
[native-chat.json](native-chat.json).

Se retiraron las sondas de proveedor e IPC y se cerró el inspector. Los chats
de prueba permanecen en la cuenta; no se borraron conversaciones del usuario.
En la prueba inicial, la captura del compositor no se usa como evidencia visual porque conservaba
el splash de una ventana sin repintar. La evidencia del panel es su DOM y el
snapshot real de actividad. Gemini se valida con pruebas de contrato; esta
prueba real utiliza OpenAI. El seguimiento siguiente sí conserva capturas
repintadas y comprobadas. No se afirma una mejora general de costo o calidad.

## Seguimiento: progreso visible y ventana flotante

La segunda captura del usuario mostraba el indicador del chat trabajando y un
monitor vacío. El wrapper sólo observaba main y silenciaba las respuestas IPC
`success: false`. Se añadió el progreso inmediato de los eventos reales del
chat, acotado a la identidad activa, sin alterar la validación main. Los rechazos
controlados muestran una advertencia sin borrar la actividad local observada.
No se atribuye la captura del usuario a una nueva causa IPC sin evidencia de esa
ejecución; las regresiones cubren explícitamente ese fallo de observación.

La suscripción combina snapshot inicial y eventos por ID y secuencia. Los
equipos activos tienen prioridad frente al historial de doce equipos. La revisión
independiente encontró dos casos que ocultaban equipos remotos al mezclar estados;
ambos se corrigieron y tienen regresiones. Cambiar la identidad desmonta el
estado anterior y descarta callbacks pendientes. El reloj se actualiza sólo
mientras el equipo está trabajando y conserva la duración reportada al terminar.

El monitor del chat flota sobre el canvas, sin reducir su ancho: 340 px de ancho,
radio de 22 px y altura limitada por el viewport. El fondo oscuro se deriva de
los tokens navy/sidebar existentes; el tema claro conserva contraste y sombra.
El estado vacío es compacto y se puede cerrar con Escape. El navegador conserva
el espacio reservado para que su vista nativa no tape el monitor.

En un chat nuevo de Electron se solicitó una activación Rethink & Delight con
dos propuestas distintas. El panel mostró ambos especialistas **Trabajando**,
main confirmó el mismo equipo en curso y la ejecución terminó **2/2** en
11.351 segundos, con el chat fuera de carga. El estado vacío se comprobó enviando
una lista vacía de actividad al renderer únicamente para ese caso visual;
no se borró el store main ni se inventaron eventos de especialistas. Las capturas
se tomaron tras repintar la ventana y se inspeccionaron:

- [Estado vacío compacto](monitor-empty.png).
- [Dos especialistas trabajando](monitor-running.png) y [metadatos del equipo](native-monitor-running.json).
- [Equipo completado](monitor-completed.png) y [metadatos finales](native-monitor-completed.json).
- [Tema claro](monitor-light.png), aplicado temporalmente a la clase del documento
  y restaurado al tema oscuro sin cambiar la preferencia guardada.

La aplicación conserva los chats de prueba. Se retiraron los helpers temporales
y se cerró el inspector; no quedan sondas de proveedor ni handlers reemplazados.

## Validación final del seguimiento

- Línea base de monitor/layout: 17/17 casos aprobados.
- Regresiones focalizadas del seguimiento: 94/94 en ocho archivos aprobados.
- Cierre del ajuste de retención: 19/19 casos de panel y servicio repetidos,
  incluidos identidad, rechazo, snapshots, reloj y callbacks tardíos.
- Revisión independiente final: sin hallazgos accionables; 19/19 casos repetidos.
- Typecheck aislado aprobado y lint incremental: 19 archivos sin deuda nueva.
- `npm run verify:pr` integrado terminó con código 0: adaptadores, harness,
  supply chain, documentación, enlaces, semillas, OpenSpec 49/49, typecheck,
  lint de 117 archivos y suite general aprobados. Resultado de la suite:
  **364 archivos y 3902 casos aprobados**, un archivo/caso opt-in omitido.
- Los cinco fallos ajenos observados en la verificación anterior ya no aparecen
  en esta ejecución integrada, tras el trabajo concurrente correspondiente.

## Validación automatizada previa al seguimiento visual

- Línea base aislada: 59 pruebas focalizadas aprobadas antes de añadir regresiones.
- Regresiones previas al arreglo: seis fallos reproducidos del selector.
- Revisión independiente: 84/84 casos focalizados y 2/2 guardas IPC aprobados.
- Suite aislada: 346 archivos aprobados, uno omitido; 3717 casos aprobados y uno
  omitido opt-in. Un primer run coincidió con modificaciones de las pruebas y
  se repitió íntegro después de finalizar el código.
- Lint incremental aislado: 13 archivos sin deuda nueva.
- OpenSpec del arreglo, enlaces y catálogo documental: válidos.
- Typecheck integrado: aprobado; lint integrado: 112 archivos sin deuda nueva.
- Regresión final integrada: 90/90 casos en seis archivos, incluyendo identidad
  del hook y restricciones IPC; comando `npm run test --
  src/__tests__/services/agent-teams.test.ts
  src/__tests__/services/chat-agent-team.test.ts
  src/__tests__/services/gemini-chat-routing.test.ts
  src/__tests__/hooks/chat-runtime-owner.test.tsx
  electron/__tests__/agent-activity-ipc.test.ts
  electron/__tests__/agent-activity-store.test.ts --maxWorkers=4`.
- Compuerta integrada general `npm run verify:pr`: terminó con código 1.
  Adaptadores, harness, supply chain, documentación, enlaces, semillas de skills,
  OpenSpec (49/49), typecheck y lint incremental aprobaron. La suite integrada
  aprobó 359 archivos y 3872 casos, omitió un archivo/caso y falló en cuatro
  archivos con los cinco casos siguientes, fuera de los archivos del arreglo:
  - `integrated-browser-agent-shortcuts.test.ts`: timeout de 15 segundos en
    cuota y guarda de commit.
  - `integrated-browser-sync-integration.test.ts`: timeout de 15 segundos en
    recuperación y sincronización entre clientes.
  - `integrated-browser-service.test.ts`: dos callbacks de permisos de cámara
    y micrófono no recibieron `true`.
  - `ToolsDropdownButton.test.tsx`: el título esperado no incluye la nueva
    opción «Sesiones síncronas» que ya presenta el componente.

Estos fallos no se corrigieron dentro de este cambio. El workspace contiene
modificaciones concurrentes del navegador y de sesiones síncronas; la evidencia
aislada y las 90 regresiones integradas verifican el flujo multiagente corregido,
sin afirmar que la compuerta general haya aprobado.

La primera compuerta aislada encontró un delta mal formado preexistente en
`launch-learning-live-sessions`. La primera compuerta principal encontró el
catálogo IPC desactualizado durante cambios concurrentes ajenos. Ambos se
resolvieron en el workspace por su trabajo correspondiente; no pertenecen a
la corrección de multiagentes. El inventario de pruebas se derivó mediante el
script del repositorio, preservando el resto de los cambios existentes.

## Reversión

Revertir sólo los archivos del arreglo y su paso `activityOwnerId`; los chats
creados durante la prueba permanecen disponibles. No hay migraciones, nuevas
herramientas, secretos ni preferencias persistentes modificadas por el arreglo.
