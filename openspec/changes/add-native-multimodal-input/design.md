## Context

Ver `proposal.md - Why` para la motivación. Lo relevante para el diseño es el estado actual de las cuatro superficies que este cambio toca.

**Compositor de contenido.** `src/services/gemini-chat/message-content.ts` recibe `finalMessage: string` y `images?: string[]`, y solo sabe convertir data URLs a `{ inlineData }`. Todo lo que quiera ser multimodal tiene que llegar como data URL, lo que fija el techo del turno en el presupuesto en línea del proveedor y obliga a materializar el medio completo en memoria del renderer.

**Cliente conversacional.** `src/services/gemini-chat/client.ts` instancia `GoogleGenerativeAI` de `@google/generative-ai`. Ese paquete está descontinuado y no tipa `videoMetadata`, `mediaResolution` ni la API de archivos; su superficie de streaming (`chat.sendMessageStream()` con `chunk.text()` como método) difiere de la de `@google/genai`, que ya es dependencia y ya se usa en `electron/desktop-agent/gemini-cu/client.ts`. El historial (`history.ts`) es texto plano en ambas formas, lo que reduce el riesgo de la migración.

**Percepción del navegador.** `IntegratedBrowserService.captureVisibleBackdrop()` ya toma un frame real del compositor mediante `contents.capturePage()`. El renderer lo adjunta al turno solo cuando el heurístico de `send-message-stream.ts` clasifica la intención como observación del navegador, y la observación pasiva reduce la captura a 1024 px en su lado mayor (`INTEGRATED_BROWSER_OBSERVATION_MAX_EDGE`) con cadencia de 30 s en superficies multimedia (`INTEGRATED_BROWSER_MEDIA_OBSERVATION_INTERVAL_MS`). El modelo no tiene ninguna herramienta para pedir un frame por su cuenta.

**Captura de audio.** `src/services/meeting-live/audio-capture.ts` ya resuelve el problema difícil: loopback de salida del sistema en Windows/macOS vía `getDisplayMedia`, dispositivo monitor en Linux, degradación declarada, y remuestreo a PCM int16 mono 16 kHz mediante AudioWorklet. Hoy solo alimenta al sidecar de transcripción de reuniones.

Restricciones del entorno: la CSP del renderer permite `connect-src https:`, de modo que una subida desde el renderer no está bloqueada por política, pero sí obligaría a materializar el archivo en memoria. `media-src` no admite `file:`, así que un adjunto de video local no puede previsualizarse con su ruta. `sharp` ya es dependencia del proceso main.

## Goals / Non-Goals

**Goals:**

- Un único punto de construcción de partes multimodales del turno, de forma que video, audio, imagen y frames de navegador compartan las mismas reglas de transporte, ventana y resolución.
- Que la evidencia visual del navegador deje de depender de que un heurístico de texto acierte: el modelo debe poder pedirla.
- Que el medio grande nunca cruce el renderer completo en memoria.
- Que toda degradación —DRM, subida fallida, medio caducado, fuente de audio no disponible— sea declarada al usuario y al modelo, nunca silenciosa.
- Que el costo por turno sea acotado y visible antes de enviarse.

**Non-Goals:**

- Migrar en este cambio los call sites periféricos del SDK legado (título de conversación, `flow-service`, `image-generation`, `browser-writing`, `prompt-optimizer`). Son llamadas de un solo disparo sin necesidad multimodal; se retiran en un cambio posterior.
- Rediseñar la observación pasiva del navegador. Su cadencia y su presupuesto se conservan tal como están; la captura explícita es una ruta paralela.
- Cambiar el catálogo visible de modelos, el selector de razonamiento o el enrutamiento a OpenAI.
- Persistir medios del usuario en Supabase o en el historial local.

## Decisions

### D1: Migrar solo la ruta conversacional Gemini a `@google/genai`, aceptando convivencia temporal de dos SDKs

Se migra `src/services/gemini-chat/*` —cliente, `send-message-stream`, `agentic-loop`, `research-action`, `web-grounding`, `streams`, `resilience`— y se deja el resto del repositorio en `@google/generative-ai` hasta un cambio de limpieza posterior.

*Por qué:* la ruta conversacional es la única que necesita `videoMetadata`, `mediaResolution` y referencias a archivos remotos. Migrar los diez call sites de golpe multiplica la superficie de regresión sin beneficio funcional, y varios de ellos (transcripción de flow, generación de imagen) tienen su propio contrato de entrada.

*Alternativas descartadas:* (a) migrar todo el repositorio en este cambio — mayor riesgo, sin ganancia; (b) parchear el SDK legado emitiendo partes sin tipar — deja el producto sobre un paquete descontinuado y obliga a implementar la subida de archivos a mano; (c) resolver el video en un servicio aparte del main — duplica bucle de herramientas y resiliencia.

*Diferencias que la migración debe cubrir explícitamente:*

| Concepto | `@google/generative-ai` (actual) | `@google/genai` (destino) |
|---|---|---|
| Cliente | `new GoogleGenerativeAI(key)` | `new GoogleGenAI({ apiKey })` |
| Sesión | `getGenerativeModel({...}).startChat({ history, generationConfig })` | `ai.chats.create({ model, history, config })` |
| Config del turno | `generationConfig` + `tools` + `systemInstruction` en el modelo | todo dentro de `config` |
| Texto del chunk | `chunk.text()` — método | `chunk.text` — descriptor de acceso |
| Llamadas a función | `chunk.functionCalls()` — método | `chunk.functionCalls` — descriptor de acceso |
| Cancelación | `Promise.race` externo | `config.abortSignal` nativo, además del timeout existente |

El paso de método a descriptor de acceso en `text` y `functionCalls` es la fuente de regresión más probable de todo el cambio: `chunk.text()` sobre el SDK nuevo lanza `TypeError` en tiempo de ejecución, y una comprobación de verdad sobre la función siempre da verdadero. Se cubre con pruebas de streaming antes de tocar el resto.

### D2: La subida por Files API vive en el proceso main, detrás de IPC

Se añade un servicio de medios en main con canales `media-input:*` (subir, consultar estado, cancelar, liberar). El renderer nunca lee el archivo; envía la ruta y recibe `{ uri, mimeType, expiresAt, state }`.

*Por qué:* satisface el requisito de no materializar el medio en el renderer, permite subir por flujo desde disco, y mantiene la clave del proveedor y la ruta local fuera del renderer. La CSP permitiría la subida desde el renderer, pero eso obligaría a leer el archivo entero como `ArrayBuffer` para un video de cientos de megabytes.

*Alternativa descartada:* subir desde el renderer con `ai.files.upload` sobre un `Blob` — más corto de escribir, incompatible con el presupuesto de memoria.

### D3: Un descriptor de medio tipado sustituye a la lista de data URLs

`buildMessageContent(finalMessage, images)` se reemplaza por un constructor de partes que acepta `MediaRef[]`, una unión discriminada:

- `{ kind: 'inline', mimeType, base64 }` — imágenes y audio corto; ruta actual conservada.
- `{ kind: 'remote', mimeType, uri, expiresAt }` — resultado de la subida en main.
- `{ kind: 'public-video', uri, window?: { startSeconds, endSeconds }, fps? }` — video público direccionable.
- `{ kind: 'frames', frames: Array<{ base64, mimeType, atSeconds }> }` — muestreo de un reproductor no direccionable.

El constructor traduce cada variante a la parte del proveedor, aplica la ventana temporal como desplazamientos en segundos, recorta a los límites reales del medio y devuelve, junto a las partes, un `MediaEnvelope` con lo efectivamente enviado (fuente, intervalo, resolución) que se propaga al resultado de herramienta visible.

*Por qué:* la lista de data URLs no puede expresar ni una referencia remota ni una ventana temporal, y forzarlo produciría cadenas con convenciones implícitas. La unión discriminada hace que el compilador exija tratar cada ruta de transporte, incluida la de rechazo.

*Compatibilidad:* `options.images` se conserva como entrada aceptada y se normaliza a `{ kind: 'inline' }` en el borde, de modo que los call sites existentes (orbe, procesador de chat, observación del navegador) no cambian su firma en este cambio.

### D4: La evidencia visual del navegador se expone como herramienta, no ampliando el heurístico

Se añade `capturar_vista_navegador` al catálogo de `INTEGRATED_BROWSER_TOOLS`, con parámetros de resolución de medios y de motivo. Fuerza `getObservation(true)` sobre la pestaña visible sin pasar por la cadencia multimedia, y devuelve la captura como parte de imagen por el mismo mecanismo que ya usa `agentic-loop.ts` para las capturas de `use_computer` (imagen aparte del JSON de respuesta).

*Por qué:* el heurístico de `send-message-stream.ts` es una lista de patrones sobre el texto del usuario; cada frase nueva que no encaje reproduce el fallo original. Una herramienta traslada la decisión al modelo, que ya tiene el contexto de la conversación. El adjunto automático por intención se conserva porque ahorra un viaje completo en el caso frecuente.

*Alternativa descartada:* ampliar los patrones del heurístico — no cierra la clase de fallo, solo casos concretos.

### D5: Video de la pestaña activa: URI pública primero, muestreo de frames como degradación

El servicio del navegador expone el estado del reproductor de la pestaña (existencia de `<video>`, posición actual, duración, si el documento tiene una URL de video pública reconocible). Con eso:

1. Si el destino es un video público direccionable, el turno envía `{ kind: 'public-video' }` con ventana centrada en la posición actual. El proveedor descarga y procesa el medio del lado servidor, con su pista de audio, sin que el equipo transfiera el video.
2. Si no lo es —contenido autenticado, reproductor propietario, archivo local servido por la página— el turno envía `{ kind: 'frames' }`: N capturas separadas por un intervalo fijo, cada una con su marca de tiempo, obtenidas por la misma ruta de captura explícita.

*Por qué:* la ruta por URI es la única que da comprensión temporal real con audio y sin costo de transferencia local, pero solo aplica a medios públicos. El muestreo de frames es peor —sin audio, sin continuidad— pero es la única alternativa honesta para el resto, y el resultado debe declarar cuál se usó.

*Alternativa descartada:* extraer el flujo del reproductor dibujando `<video>` en un `<canvas>`. Es inviable en la práctica: el medio se sirve desde un origen distinto sin CORS, lo que contamina el lienzo y hace que su exportación lance `SecurityError`. Además equivaldría a extraer el flujo de la página, que está fuera de alcance por diseño.

### D6: Detección de frame no utilizable en main, antes de que salga del equipo

Antes de codificar una captura, main evalúa el bitmap con `sharp` (ya dependencia) y descarta el frame cuando su desviación estándar por canal cae bajo un umbral —imagen uniforme, típicamente negra— o cuando `capturePage` devuelve una imagen vacía. El servicio devuelve un fallo clasificado (`contenido-protegido`, `captura-vacia`) en lugar de la imagen.

*Por qué:* el compositor no entrega la superficie de contenido protegido por DRM y devuelve negro. Enviar ese frame produce exactamente la falla que este cambio existe para evitar: una descripción inventada de una escena no observada. La comprobación es barata y ocurre antes de cualquier salida de datos.

*Trade-off aceptado:* una escena legítimamente negra (fundido, pantalla apagada) se clasifica como no utilizable. Es el error correcto: declarar que no se ve nada cuando efectivamente no se ve nada.

### D7: La escucha ambiental reutiliza el pipeline de reuniones y encapsula en WAV

Se extrae de `MeetingAudioCapture` la parte de adquisición y remuestreo, y se añade un consumidor nuevo que acumula el PCM del intervalo y lo encapsula como WAV mono 16 kHz —cabecera de 44 bytes sobre el PCM que el worklet ya produce— para enviarlo como medio en línea.

*Por qué:* el problema difícil (loopback por plataforma, permisos, degradación declarada) ya está resuelto y probado. WAV evita añadir un codificador: un minuto de audio mono 16 kHz son ~1,9 MB, muy por debajo del presupuesto en línea, y el proveedor lo remuestrea de todos modos.

*Alternativa descartada:* reutilizar `MediaRecorder` con Opus en WebM — menor tamaño, pero introduce una segunda ruta de captura en paralelo a la de reuniones y un contenedor cuya compatibilidad hay que verificar.

### D8: Presupuesto de medios explícito por turno

Se añaden parámetros de runtime documentados: ventana máxima de video por turno, umbral de duración a partir del cual la resolución de medios baja automáticamente, número y separación de frames en el muestreo, duración máxima de escucha ambiental y presupuesto de tokens de medios por turno. La degradación es ordenada: primero baja la resolución, luego acorta la ventana, y solo entonces informa que un medio no cabe.

*Por qué:* el video consume del orden de cientos de tokens por segundo enviado a resolución media. Sin límites explícitos, una pregunta casual sobre un video de una hora produce un turno de coste desproporcionado. Los valores viven en `docs/architecture/runtime-parameters.md`, no dispersos en el código.

### D9: El prompt distingue evidencia por captura de entrada de video real

La regla vigente de `src/prompts/chat.ts` —"la observacion ocurre mediante capturas actuales e iterativas; no la presentes como una transmision continua de video"— deja de ser universal. Pasa a condicionarse: se mantiene cuando la evidencia del turno son capturas, y se sustituye por una regla de declaración de intervalo cuando el turno envió video. Se añade la instrucción de no pedir al usuario que abra la transcripción de un video cuando la ruta de video está disponible.

## Risks / Trade-offs

- **Regresión del streaming por el cambio de método a descriptor de acceso en `text` y `functionCalls`** → Migrar `streams.ts` y su cobertura antes que cualquier otro archivo, con una prueba que consuma un stream simulado del SDK nuevo y falle si se invoca `text` como función.
- **Dos SDKs de Google conviviendo en el árbol de dependencias** → Aceptado de forma acotada y visible: se registra en `scripts/quality/check-supply-chain.mjs` y se abre la tarea de retirar `@google/generative-ai` en un cambio posterior. Ambos ya están instalados hoy, así que el cambio no aumenta la superficie descargada.
- **Costo por turno mayor y menos predecible** → Presupuesto explícito de D8, resolución reducida por omisión en ventanas largas y declaración del intervalo enviado en el resultado de herramienta, para que el usuario vea qué se envió.
- **Salida de datos nueva: medios del usuario transferidos al proveedor** → Consentimiento explícito antes de la primera subida de la sesión, caducidad respetada sin reutilizar referencias vencidas, sin persistencia local del audio capturado, y tratamiento del flujo en `docs/security/security-and-privacy.md`.
- **La ruta por URI pública solo funciona con medios públicos; un video privado o autenticado falla del lado del proveedor** → Detectar el fallo y degradar a muestreo de frames declarándolo, en lugar de reportar que el video no puede analizarse.
- **`capturePage` a resolución completa es más caro que la captura pasiva acotada y compite con el compositor de la página** → La captura explícita conserva el mecanismo de aplazamiento durante interacción ya existente y se limita con una separación mínima entre invocaciones consecutivas de la herramienta.
- **El muestreo de frames puede inducir a describir el video como si se hubiera visto completo** → El resultado de herramienta declara explícitamente que la evidencia es un muestreo, con sus marcas de tiempo, y el prompt exige reflejarlo.
- **La escucha ambiental captura audio de terceros presentes en la llamada o en la sala** → Petición explícita por turno, indicador visible mientras dura, duración máxima acotada y descarte al resolverse el turno.

## Migration Plan

1. **Cliente nuevo en paralelo.** Añadir el cliente `@google/genai` sin retirar el existente. `client.ts` expone ambos durante la transición.
2. **Streaming primero.** Migrar `streams.ts` y `resilience.ts` con su cobertura, verificando texto, llamadas a función, cancelación por señal y clasificación de errores.
3. **Turno conversacional.** Migrar `send-message-stream.ts`, `agentic-loop.ts`, `research-action.ts` y `web-grounding.ts`. En este punto el producto es funcionalmente idéntico al actual: misma entrada, mismas herramientas, mismo streaming.
4. **Constructor de partes.** Sustituir `message-content.ts` por el constructor de `MediaRef[]`, con la normalización de compatibilidad de `options.images`.
5. **Capacidades nuevas.** Servicio de medios en main, herramienta de captura explícita, estado del reproductor y ruta de video, adjuntos de medio, escucha ambiental. Cada una es independiente de las demás y puede entregarse por separado.
6. **Prompt y enrutamiento.** Ajustar `chat.ts` y el heurístico de intención al final, cuando las herramientas ya existan.
7. **Documentación.** `docs/architecture/runtime-agents-manual.md` (catálogo de herramientas, guardas y límites), `runtime-parameters.md`, `ipc-and-integrations.md`, `security-and-privacy.md` y `test-strategy-and-inventory.md`.

**Rollback.** Cada capacidad nueva queda tras un parámetro de runtime que la desactiva: sin herramientas de medio, sin adjuntos de video/audio y sin escucha, el producto vuelve exactamente al comportamiento de captura fija actual. La migración de SDK es el único paso no reversible por parámetro; su reversión es el revert de los pasos 1 a 3, que no tocan datos persistidos ni contratos IPC existentes.

## Open Questions

- Si el consentimiento de subida al proveedor debe pedirse una vez por sesión, una vez por conversación o una vez por archivo. No cambia specs ni tareas: el punto de decisión y su copy ya están fijados; solo varía el alcance de la memoria de la respuesta.
- Si la escucha ambiental debe ofrecerse también desde la Orbe además del compositor de chat. La captura y su gobierno son los mismos; solo cambia el punto de entrada de la interfaz.
