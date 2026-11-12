# Avatar SofLIA 2D

Estado: vigente. Implementación: cambio `replace-orb-with-avatar`.

<!-- evidence: src/components/avatar/SofliaAvatar.tsx -->
<!-- evidence: src/components/avatar/useAvatarMotion.ts -->
<!-- evidence: src/components/orb/OrbCanvas.tsx -->

## Composición e identidad

[SofliaAvatar](../../src/components/avatar/SofliaAvatar.tsx) presenta la primera
imagen aprobada por el usuario. [Los recursos](../../src/assets/soflia-avatar/provenance.json)
conservan dimensiones y hash SHA-256 de esa fuente. El [extractor](../../scripts/avatar/extract-assets.mjs)
genera PNG transparentes y una máscara SVG; se reproduce con
`node scripts/avatar/extract-assets.mjs`. El original también permanece versionado.

Cuerpo, bandas, logo, reflejos y luces conservan los píxeles originales. Tras la
revisión visual solicitada por el usuario, el visor se uniforma con una muestra
oscura del propio original: no conserva profundidad ni cuencas oculares. Las catorce
expresiones son señales SVG planas y luminosas basadas en la lámina aprobada:
barras en espera, onda de entrada al escuchar, círculo de puntos al pensar y ojos
abiertos con boca reactiva al responder. Éxito, advertencia y duda usan símbolos grandes centrados. Curiosidad,
alegría, concentración, confirmación y reposo tienen trazos diferentes. Los ojos
raster originales quedan disponibles como recursos transparentes, fuera del render.
El PNG estático conserva exactamente cada píxel RGB visible de la fuente y se
comprueba con `node scripts/avatar/verify-assets.mjs`. El halo del suelo se
representa mediante una sombra tenue; no se conserva el fondo rectangular.
El SVG recorta el contorno visible y puede necesitar refinamiento si cambia la fuente.
La máscara [visor.svg](../../src/assets/soflia-avatar/visor.svg) delimita la pantalla
uniforme; el cuerpo exterior permanece original.

## Contratos y prioridades

La ref pública ofrece `setState`, `setExpression`, `setAudioLevel`,
`setGazeTarget`, `blink`, `nod` y `reset`. Las props ofrecen estado declarativo,
expresión opcional, `audioLevel` como ref 0..1, `motionEnabled` y configuración de
mirada. El estado declarativo nuevo descarta acciones imperativas antiguas.
`reset` recupera las props, devuelve la mirada al centro y libera la amplitud manual.

Las catorce expresiones están en [avatar-model](../../src/components/avatar/avatar-model.ts),
incluidas Sorpresa y Preocupación.
`acting`, conservado por OrbCanvas, se representa con `focused`. Los estados
listening, thinking, acting/focused, speaking, success, warning y sleeping tienen
prioridad sobre decoraciones. Esos estados desactivan seguimiento y gestos manuales.
Éxito y advertencia son señales visuales explícitas, nunca confirmaciones de una
operación no verificada. El error real de conversación activa warning.

La [fachada OrbCanvas](../../src/components/orb/OrbCanvas.tsx) conserva
`visualState`, `audio` y `motionEnabled` para ventana de voz, asistencia e
instalador. Sus flechas controlan la mirada; Inicio, Enter y doble clic restablecen.
Los archivos de geometría y shaders anteriores permanecen como referencia de
reversión durante esta entrega, fuera de los imports del avatar y de su bundle.
No se cargan Three.js, GLB, Blender ni WebGL para representar el personaje.

## Movimiento y audio

Un RAF por instancia modifica variables CSS sin renders React por fotograma.
La mirada usa el rectángulo actual del personaje, coordenas normalizadas -1..1,
interpolación exponencial de 105 ms y desplazamientos de 2.7% horizontal
y 1.8% vertical de la imagen. El retorno al centro es gradual al acercarse al
límite de 4.5 semiejes. La configuración limita el recorrido a 3.5% y 2.5%.
La mirada acompaña ojos, cejas y rostro sin desplazar el cuerpo. Inclinación, flotación,
parpadeo, asentimiento y luz tienen controladores separados.

IntersectionObserver, ResizeObserver, visibilidad documental y cambios de
preferencia controlan el ciclo de vida. Perder foco devuelve la mirada al centro
pero mantiene la respuesta de voz de la ventana flotante. Movimiento reducido mantiene expresiones
estáticas y pausa luz, gestos y mirada. Se retiran listeners, observers y RAF al
desmontar; StrictMode conserva un solo bucle.

El avatar consume las refs existentes de [useAudioFeatures](../../src/components/orb/useAudioFeatures.ts),
alimentada por el micrófono durante escucha y por el nodo TTS durante habla. No
crea permisos ni capturas adicionales. En dictado del chat, un analizador con
AudioContext propio consume el MediaStream ya autorizado y libera sólo su nodo y
contexto al terminar; nunca detiene las pistas prestadas. El TTS reutiliza su
contexto y nodo existentes. Sin señal funciona con nivel
cero. La fachada entrega amplitud, tono y bandas; las refs opcionales de registro
y confianza provienen de [voice-pitch](../../src/components/orb/voice-pitch.ts),
que reutiliza la ventana de audio cada 50 ms para estimar voz de 80..650 Hz. Si
la confianza es insuficiente se utiliza el centroide espectral. Las barras y el
rostro al escuchar responden al registro, las bandas y el volumen.

[La articulación acústica](../../src/components/avatar/avatar-voice.ts) modifica
apertura, anchura y redondez de la boca con el audio de salida y la cierra durante
pausas. El contrato TTS actual no contiene fonemas o palabras alineadas: este
comportamiento no afirma sincronización labial fonética exacta ni comprensión
semántica. La ruta de voz, sus permisos y el proveedor permanecen iguales.

Curiosidad combina ojos abiertos asimétricos y ceja elevada. Durmiendo muestra
párpados relajados y respiración tenue, con tres letras Zzz que ascienden fuera
del cuerpo y del visor. En movimiento reducido queda una indicación estática.
Confirmación usa sonrisa y asentimiento del rostro dentro del visor, sin palomita
ni insignia; conserva una cara propia frente al check grande
de éxito. La boca de Respondiendo se mueve independientemente del parpadeo.

Los catorce estados tienen gestos ambientales continuos desde su montaje, sin
esperar interacción o audio. [Los perfiles](../../src/components/avatar/avatar-motion.ts)
combinan flotación vertical, balanceo, inclinación y pulso dentro del mismo RAF.
Confirmación repite un asentimiento de 1.3 segundos con amplitud facial objetivo
del 2.8% de la altura; el cuerpo flota sólo 0.3%, sin deriva ni rotación lateral.
El rostro tiene traslación e inclinación independientes del cuerpo. Pensando
combina órbitas, puntos, pulso y desplazamiento facial. La onda de escucha
mantiene un gesto de disponibilidad separado de la amplitud medida; el nivel de
audio sigue siendo cero cuando no hay señal. La pausa explícita, la visibilidad
y movimiento reducido suspenden todos estos gestos.

La pose renderizada persiste entre expresiones y converge a la nueva pose con
interpolación exponencial independiente del tiempo entre fotogramas: 85 ms para
flotación, 180 ms para deriva e inclinación y 100 ms para rostro y pulsos. No se
encadena una segunda transición CSS sobre estas transformaciones. Los eventos
del ratón se agrupan en una lectura de geometría por fotograma y se omiten
escrituras CSS cuando el valor no cambió. El brillo usa filtros constantes; la
intensidad se anima con opacidad y la banda luminosa oscila sin saltos de fase.
El analizador de audio conserva su ciclo existente, independiente del RAF visual.

## Demostración y verificación

Iniciar la [fixture](../../test/manual/soflia-avatar/main.tsx) con:

```powershell
node node_modules/vite/bin/vite.js --config test/manual/soflia-avatar/vite.config.mts
```

Abrir `http://127.0.0.1:4330/`. Permite revisar expresiones, tamaño 112..560 px,
fondos, pausa, gestos, registro y amplitud manual identificados como demostración.
Un archivo local opcional usa el mismo analizador de producción. «Probar mi voz
con micrófono» solicita captura sólo al pulsarlo y la libera al detener, usar
controles manuales o desmontar. No se sube audio a servicios ni se requiere sesión.
No usar los controles manuales como prueba de voz real.

El [script de QA y exportación](../../scripts/avatar/verify-demo.mjs) mide y exporta
el componente en ejecución. Los GIF/WebM son derivados de presentación, no la
fuente de sus animaciones. [La evidencia](../../openspec/changes/replace-orb-with-avatar/reports/verification.md)
declara resultados, límites y riesgos. La meta de 60 FPS requiere medición en el
hardware destino; el resultado local no garantiza otros equipos.


## Presencia en Hub, chats y navegador

[ChatUI](../../src/adapters/desktop_ui/ChatUI.tsx) integra una presencia por
conversación mediante [ChatAvatar](../../src/adapters/desktop_ui/chat-ui/ChatAvatar.tsx).
La bienvenida y el compositor alternan el personaje vivo; el historial conserva
miniaturas livianas. El chat general, el lateral del navegador y las conversaciones
de proyectos comparten esta ruta. El inicio de conversación de proyecto también
reacciona al borrador. Se retiraron los usos del retrato femenino del asistente.

[El reloj de presencia](../../src/components/avatar/avatar-presence.ts) ofrece
alegría durante 900 ms al activarse, espera y reposo a los 20 segundos de inactividad.
Permisos reales tienen prioridad sobre errores, ejecución, voz y borrador. Pensar
más de seis segundos pasa a concentración. Los resultados concluyentes muestran
un gesto durante 2.4 segundos; tareas pendientes o parciales no celebran éxito.
Los trabajos en segundo plano usan el snapshot autenticado y requieren vínculo
con el mensaje y conversación visibles; un turno nuevo sustituye su gesto.
Cambiar conversación cancela su actividad y evita aplicar callbacks tardíos.

El dictado del chat mueve el rostro con la señal existente. Durante streaming
escrito sin voz, la boca realiza un gesto ambiental de conversación explícitamente
separado de la articulación acústica; no representa audio ni alineación fonética.

[BrowserHomePage](../../src/components/browser/BrowserHomePage.tsx) monta el
componente sobre el documento de inicio compartido. El documento nativo usa
[plantillas SVG del mismo componente](../../electron/integrated-browser/home/avatar-markup.tsx),
recursos embebidos, CSS y perfiles compartidos. Su adaptador DOM local tiene hash
SHA-256 exacto en CSP; no posee Node, IPC, conexiones ni dependencias remotas.
No se concede `unsafe-inline` a scripts. El buscador conserva envío HTTPS normal.

Las reglas de borrador son heurísticas locales y decorativas, compartidas entre
compositores y portada: curiosidad, sorpresa, duda y advertencia. No transmiten,
persisten ni registran el texto y nunca conceden autorización para actuar.

La [fixture de integración](../../test/manual/soflia-avatar/integration.tsx) se
sirve con `node node_modules/vite/bin/vite.js --config test/manual/soflia-avatar/integration.vite.config.mts`.
Abrir `http://127.0.0.1:4331/integration.html`; `/native-home` conserva la CSP nativa.
El [QA automatizado](../../scripts/avatar/verify-integration.mjs) comprueba
reactividad, boca, movimiento reducido, cadencia y ventanas estrechas. No sustituye
la prueba de una sesión autenticada con proveedores reales.
