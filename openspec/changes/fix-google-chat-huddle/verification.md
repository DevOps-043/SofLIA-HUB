# Verificación de Huddle

Fecha: 2026-10-06. Estado: inicio de Huddle, tarjeta y panel de llamada
verificados en la aplicación real; intentos de prueba cerrados.

## Cambios y frontera de evidencia

Se retiró el rechazo específico de `/call` en navegación, redirección, frames
y ventanas adoptadas. La apertura HTTPS exacta desde Gmail/Chat usa una ventana
real gobernada, conservando las opciones de sesión y abridor. La preparación
es idempotente. Una ventana que navega a otro sitio pierde la excepción nativa.
No se ampliaron permisos de dispositivos ni se añadieron IPC, fallbacks,
temporizadores, modificaciones de SDP o field trials.

Antes de ocultar la API incompleta, la prueba autorizada con Alexis fallaba:
el teléfono pasa brevemente a rojo y vuelve al estado ordinario, sin nueva
tarjeta ni ventana visible. No se confirma conexión o timbrado del destinatario.
El registro temporal saneado mostró `DisconnectedError`, `EndCause = 0`,
`StartupCode = 219` y colisión BUNDLE de Opus payload 111, con parámetros que
difieren en `stereo=1`. Esto identifica la frontera del fallo; no demuestra
por sí solo que la colisión sea su única causa. Los intentos históricos de
desactivar esa validación tampoco demostraron una llamada funcional.

DevTools también mostró `ERR_CACHE_MISS` en una petición del service worker a
`meet.google.com/_/frame`, mientras RPC de resolución y usuario devolvían 200.
No se atribuye el fallo a esa precarga sin una prueba causal adicional.

## Runtime

El manifiesto y lockfile originales fijan 43.4.0, pero el paquete instalado y
ejecutable local reportan 44.0.0-beta.3 / Chromium 152.0.7977.30. Las pruebas con
esa instalación no acreditan el runtime estable declarado.

Se descargó 44.5.1 estable / Chromium 152.0.7977.130 desde Electron y se comprobó
el SHA-256 oficial del ZIP:
`9b382492dcfee91f8f9e92c91f7972550a1b95d2299cac72279dab33a600d7db`.
Actualizar Electron solo no corrigió Huddle. Tras validar la corrección de
capacidades se fijó 44.5.1 estable en manifiesto y lockfile, y se alinearon paquete
y ejecutable. `npm run runtime:stable` confirma coincidencia de los cuatro.
La instalación beta anterior permanece en un directorio temporal de recuperación.
El usuario arrancó la aplicación estable manualmente: la revisión automática
rechazó el arranque directo del agente, sin más detalle que `blocked by policy`.
El intento previo al cambio de capacidades volvía al teléfono ordinario sin
ventana ni tarjeta nueva, aunque utilizara ese runtime estable.

El smoke de ciclo de vida pasó tanto en 43.4.0 como 44.5.1: tres comprobaciones
por runtime sobre beforeunload, espera de limpieza y salida única. Se usaron
perfiles temporales separados, sin cookies de Google ni `.env`.

Una sonda sintética de SDP de dos transceptores de audio, sin dispositivos ni
red externa, fue aceptada por ambos runtimes (beta y estable). Por tanto, esa
sonda no reproduce el fallo real y no se utiliza para afirmar una reparación.

Una prueba nativa aislada cargó el servicio real del bundle y atendió Gmail/Meet
con respuestas locales de protocolo en un perfil temporal, sin Google ni red
externa. Confirmó sesión heredada, `window.opener`, mensaje del hijo al abridor,
popup reconocido por gobernanza y ausencia de pestañas adicionales en 44.5.1.
Esto verifica semántica del popup, no el arranque remoto de Meet.

## Comprobaciones

- Servicio y handlers: 238/238 pruebas aprobadas (207 del servicio, 31 handlers).
- Regresión del origen actual en popup anidado: 2 focales aprobadas.
- Typecheck del checkout principal: aprobado tras el ajuste final de código.
- Build de renderer, main y preload: aprobado con la corrección de capacidades;
  repetido tras normalizar el runtime.
- Arnés: 25 rutas y 9 skills válidas.
- Enlaces del checkout principal: 361 Markdown activos válidos.
- OpenSpec `fix-google-chat-huddle`: válido en modo estricto.
- `verify:pr`: detenido en `docs:system:check` por inventario de pruebas
  desactualizado; el checkout original también reproduce esa deuda antes del
  cambio. No se declara la compuerta aprobada.

## Revisión independiente

La revisión adversarial independiente encontró que la ventana anidada usaba el
origen heredado incluso tras navegar fuera de Gmail/Chat. Se corrigió usando el
documento actual y conservando la herencia solo mientras el destino es vacío.
Las regresiones Gmail → blank → otro sitio → `/call` y un segundo hijo blank
pasan. Se revisaron permisos,
aislamiento, sesión y duplicación de listeners; no se detectaron concesiones
nuevas de dispositivos. La revisión adicional valida la reducción de capacidad
mediante `webPreferences` público y exige documentar alcance y criterio de retiro.

## Alcance y límites del resultado

Se acredita inicio, registro real y panel de controles. No se verifica audio
entre dos participantes, cámara ni pantalla: el destinatario no respondió
durante estas pruebas breves.
La instrumentación temporal del código se retiró; no se versionan HAR, cookies,
tokens ni logs completos de Chromium.

## Diferencia reproducible de Document Picture-in-Picture

La prueba de caché con el service worker omitido también devuelve StartupCode
219. Se restauró `Bypass for network` a su estado inicial y se cerró DevTools.

Una sonda separada sobre el servicio real llamó
`documentPictureInPicture.requestWindow()` con activación de usuario en un
origen HTTPS local interceptado. La promesa resolvió, pero no se creó una
BrowserWindow ni se ejecutó el creador gobernado; solo permanecieron el padre
y la vista. Es distinto de `window.open`, que sí pasó la prueba de ventana real.
El [reporte upstream](https://github.com/electron/electron/issues/39633) conserva
esa limitación abierta. El código público de Electron 44.5.1 rechaza en
`-add-new-contents` disposiciones distintas de foreground-tab, new-window y
background-tab antes de invocar `createWindow`.

Se aplica `disableBlinkFeatures: 'DocumentPictureInPictureAPI'` en las vistas
del navegador para no anunciar una capacidad incompleta. La nueva sonda nativa
confirma `typeof window.documentPictureInPicture === 'undefined'` y que el
popup ordinario exacto conserva sesión, abridor y gobernanza. No modifica
certificados, SDP, cookies ni permisos.

## Prueba real con la corrección de capacidades

Tras reiniciar y entrar en Gmail con DocumentPictureInPictureAPI oculta:

1. Durante la interacción manual del usuario apareció una tarjeta nueva
   «Call started»/«Llamada iniciada», con «Join»/«Unirse», y el panel flotante con
   identidad de llamada, micrófono, cámara, pantalla y salida.
2. El agente repitió el inicio autorizado en la conversación de Alexis. Se
   observó «Abandonar huddle», panel «Llamando…» y otra tarjeta «Call started».
3. Se pulsó la salida del panel. Desapareció, volvió «Llamar a Pedro Alexis» y
   no quedó llamada activa. Las tarjetas de Google registran intentos reales;
   ninguna fue fabricada por SofLIA.

La diferencia frente al mismo 44.5.1 anterior es ocultar la API incompleta.
Se conserva porque el smoke real reproduce el inicio esperado. Afecta a
Document PiP de todos los sitios en estas vistas; la API PiP de vídeo es distinta
y no se desactiva. Retiro: soporte upstream y sonda nativa de ventana, sesión,
abridor y gobernanza, seguido de Huddle real satisfactorio.
