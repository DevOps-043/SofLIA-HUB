# Diagnóstico de Huddle en SofLIA

Fecha: 2026-10-06, America/Mexico_City.
Estado: diagnóstico realizado; llamada funcional pendiente de corrección y validación.
Alcance: inspección del código, compilación existente, pruebas dirigidas e intento
manual sobre la aplicación abierta. No se modificó el comportamiento runtime.

## Hallazgo confirmado en código

El [servicio del navegador](../../../../electron/integrated-browser/service.ts)
bloquea la ruta HTTPS exacta `meet.google.com/call` y `/call/` cuando procede de
`mail.google.com` o `chat.google.com`. La decisión no distingue una llamada
iniciada por el usuario de una apertura automática: se basa en origen y destino.

El bloqueo cubre `window.open`, navegación, redirección, subframes y ventanas
adoptadas que pasan de `about:blank` a `/call`. Cancela el evento y, en la última
ruta, cierra la ventana. No crea una reunión alternativa.

La compilación referenciada por `dist-electron/main.js` durante esta inspección
(`integrated-browser-CQJMvuH_.js`, generado a las 13:55 del mismo día) también
contiene el bloqueo. No se recompiló ni reinició la aplicación del usuario.

Esta regla está especificada en el escenario «Llamada directa nativa desde
Google Chat» de la [especificación activa](../specs/integrated-agent-browser/spec.md).
La sección «Retirada definitiva de la llamada directa» de la
[verificación histórica](../verification.md) registra la decisión del 2026-08-13,
después de aperturas sin una acción inequívoca del usuario.

## Prueba sobre la aplicación abierta

El usuario autorizó expresamente llamadas de prueba a las cuentas de Alexis o
DevOps. Se realizó un único intento en la conversación abierta con Alexis.

- Antes del intento, la conversación contenía una tarjeta de llamada perdida
  preexistente, procedente de la prueba anterior del usuario.
- Al pulsar el control de llamada, cambió a «Abandonar huddle».
- No apareció una ventana de llamada ni una nueva tarjeta de llamada en el chat
  durante la observación.
- Se abandonó el intento desde el control rojo; el icono volvió al teléfono
  ordinario. Se cerraron los inspectores abiertos para el diagnóstico.
- La consola visible de Gmail mostró errores CORS de vistas previas de Drive y
  bloqueos de imágenes, sin una causa específica de Meet identificable en esa
  captura. No se atribuyen esos errores a Huddle.

Límite de evidencia: no se capturó el evento de navegación de main ni un HAR de
este intento. La reproducción confirma el síntoma y la inspección confirma la
política activa; la URL emitida por este intento concreto no quedó registrada.
No se confirma recepción, timbrado ni conexión en la cuenta destinataria.

## Verificación automatizada

Las pruebas existentes del [servicio](../../../../electron/__tests__/integrated-browser-service.test.ts)
ejercitan el bloqueo, la ausencia de nuevas pestañas y el soporte genérico de
Picture-in-Picture.

1. `npm run test:main -- electron/__tests__/integrated-browser-service.test.ts -t "bloquea la llamada directa|bloquea /call|cancela about:blank|Picture-in-Picture"`:
   4 aprobadas, 196 omitidas, código 0.
2. `npm run test:main -- electron/__tests__/integrated-browser-service.test.ts -t "media|camara|microfono|permiso|ventana real|llamada directa|bloquea /call|cancela about:blank"`:
   15 aprobadas, 185 omitidas, código 0.
3. `npm run test:main -- electron/__tests__/integrated-browser-service.test.ts`:
   200 aprobadas, código 0.
4. `npm run docs:check`: enlaces válidos en 355 archivos Markdown activos,
   código 0; repetido tras completar el reporte.

No se ejecutaron typecheck, build ni la compuerta de PR porque esta entrega solo
añade evidencia de diagnóstico y no modifica código o contratos.

Estos resultados validan la política implementada; no demuestran que Huddle
funcione ni que los dispositivos reales estén disponibles.

## Interpretación y siguiente corrección verificable

El bloqueo deliberado es una barrera confirmada para cualquier Huddle que use
esa ruta. El historial además registra `DisconnectedError` y `StartupCode 219`
en intentos anteriores a la retirada. Es evidencia histórica, no un error
observado en la prueba actual. Retirar la regla no basta para afirmar que esos
problemas de compatibilidad desaparecieron.

Para recuperar Huddle con un cambio pequeño y trazable se necesita especificar
y probar la apertura nativa gobernada conservando sesión y relación con el
abridor, limitar su inicio a consentimiento humano verificable y mantener
permisos por origen, aislamiento, certificados y protección de navegación.
La validación debe cubrir llamada explícita, apertura automática rechazada,
subframes, popup, cierre y recepción real entre dos cuentas autorizadas.
No corresponde crear `/new`, simular tarjetas de llamada, falsificar capacidades
ni conceder permisos multimedia globales como sustituto.

Se conservaron los cambios ajenos existentes. No se editaron secretos,
configuraciones locales, dependencias ni código de producción.
