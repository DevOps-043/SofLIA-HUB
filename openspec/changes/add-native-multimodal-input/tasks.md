## 1. Base del SDK y streaming

- [ ] 1.1 Añadir en `src/services/gemini-chat/client.ts` un cliente `@google/genai` en paralelo al existente, con la misma resolución de llave (base de datos primero, entorno como respaldo) y el mismo reinicio por cambio de llave; conservar `resetClient` funcionando para ambos.
- [ ] 1.2 Escribir pruebas de streaming contra la forma del SDK nuevo en `src/__tests__/services/`: chunk con `text` y `functionCalls` como descriptores de acceso, y una aserción que falle si el código los invoca como función.
- [ ] 1.3 Migrar `src/services/gemini-chat/streams.ts` al stream del SDK nuevo conservando `collectStreamText`, `singleChunkStream`, `completedStreamResult`, `stoppedStreamResult` e `isAbortError`.
- [ ] 1.4 Migrar `src/services/gemini-chat/resilience.ts`: mantener circuit breaker, reintentos y timeouts, y añadir el paso de `abortSignal` nativo del SDK sin retirar el `Promise.race` existente.
- [ ] 1.5 Verificar que `src/services/gemini-chat/public-error.ts` sigue clasificando correctamente los errores del SDK nuevo (cuota, sobrecarga, llave inválida, seguridad) y ajustar los patrones que cambien de forma.

## 2. Turno conversacional migrado

- [ ] 2.1 Migrar la creación de sesión en `send-message-stream.ts` de `getGenerativeModel(...).startChat(...)` a `chats.create({ model, history, config })`, moviendo `tools`, `systemInstruction` y `generationConfig` dentro de `config`.
- [ ] 2.2 Migrar `agentic-loop.ts`: lectura de `functionCalls`, envío de respuestas de herramienta, recolección de imágenes en línea de ejecución de código y la ruta que adjunta capturas como imagen aparte del JSON.
- [ ] 2.3 Migrar `research-action.ts` y `web-grounding.ts`, conservando el comportamiento de grounding, `URL Context` y la combinación con ejecución de código de `supportsCodeExecutionCombo`.
- [ ] 2.4 Añadir `mediaResolution` a `buildGenerationConfig` en `model-config.ts` como parámetro del turno, con el valor por omisión actual cuando no se especifica.
- [ ] 2.5 Ejecutar la suite existente de `gemini-chat` (`gemini-chat.test.ts`, `gemini-chat-resilience.test.ts`, `gemini-chat-routing.test.ts`) y dejarla en verde sin cambiar sus aserciones de comportamiento.

## 3. Constructor de partes multimodales

- [ ] 3.1 Definir el tipo `MediaRef` como unión discriminada (`inline`, `remote`, `public-video`, `frames`) y el tipo `MediaEnvelope` de lo efectivamente enviado, en `src/shared/` para que main y renderer compartan el contrato.
- [ ] 3.2 Sustituir `src/services/gemini-chat/message-content.ts` por un constructor que traduzca `MediaRef[]` a partes del proveedor, incluidos `fileData` con URI y `videoMetadata` con desplazamientos en segundos.
- [ ] 3.3 Implementar el recorte de ventana a los límites reales del medio y el rechazo explícito por formato no admitido o tamaño fuera de todo límite, devolviendo el motivo clasificado.
- [ ] 3.4 Normalizar `options.images` a `MediaRef` de tipo `inline` en el borde de `send-message-stream.ts`, sin cambiar la firma pública de `sendMessageStream`.
- [ ] 3.5 Implementar la degradación ordenada por presupuesto: bajar resolución, luego acortar ventana, luego informar el medio excluido; devolver siempre el `MediaEnvelope` resultante.
- [ ] 3.6 Pruebas del constructor: cada variante de `MediaRef`, ventana recortada, ventana negativa, tipo MIME ausente, presupuesto excedido y contenido del `MediaEnvelope`.

## 4. Servicio de medios en main

- [ ] 4.1 Crear `electron/media-input/service.ts` con subida por flujo desde ruta de disco a la API de archivos del proveedor, espera de procesamiento con tiempo límite, y cancelación.
- [ ] 4.2 Registrar los canales `media-input:upload`, `media-input:status`, `media-input:cancel` y `media-input:release` con validación de entrada, siguiendo el patrón de handlers existente.
- [ ] 4.3 Exponerlos en la allowlist del preload y en el wrapper tipado del renderer.
- [ ] 4.4 Implementar el registro de caducidad y la detección de referencia vencida, con resubida cuando el archivo local sigue disponible y fallo declarado cuando no lo está.
- [ ] 4.5 Implementar el consentimiento previo a la primera subida de la sesión, con la confirmación renderer del sistema de diseño en lugar de un cuadro nativo.
- [ ] 4.6 Sanear los errores de subida: causa clasificada sin clave del proveedor ni ruta local completa.
- [ ] 4.7 Pruebas de `electron/__tests__/media-input-service.test.ts`: subida correcta, procesamiento que no completa, cancelación, caducidad, fallo de red y saneamiento del error.

## 5. Captura explícita del navegador y evidencia no utilizable

- [ ] 5.1 Añadir en `IntegratedBrowserService` una captura explícita que fuerce frame fresco a resolución completa del viewport, independiente de la cadencia multimedia, con separación mínima entre invocaciones consecutivas.
- [ ] 5.2 Implementar la detección de frame no utilizable con `sharp` en main: imagen vacía o desviación estándar por canal bajo umbral, devolviendo `contenido-protegido` o `captura-vacia`.
- [ ] 5.3 Exponer la capacidad por IPC (handler, allowlist, preload, wrapper) siguiendo el contrato cerrado existente de `integrated-browser:*`.
- [ ] 5.4 Añadir la herramienta `capturar_vista_navegador` a `INTEGRATED_BROWSER_TOOLS` en `src/services/gemini-tools/integrated-browser-tools.ts`, con su nombre visible en `tool-display-names.ts`.
- [ ] 5.5 Cablear su despacho en `src/services/gemini-chat/tool-dispatch.ts` para que devuelva la imagen por la ruta de parte aparte y el motivo clasificado cuando falla.
- [ ] 5.6 Pruebas: frame fresco durante contenido en movimiento, navegador no visible, frame uniforme rechazado, captura vacía y separación mínima entre invocaciones.

## 6. Video de la pestaña activa

- [ ] 6.1 Añadir a la observación del navegador el estado del reproductor: existencia de elemento de video, posición actual, duración y si el destino es un video público direccionable.
- [ ] 6.2 Implementar la ruta `public-video`: construir la ventana centrada en la posición actual acotada por el máximo por turno y devolver el `MediaEnvelope` con fuente e intervalo.
- [ ] 6.3 Implementar la degradación a `frames`: muestreo de N capturas con separación fija y marca de tiempo por frame, declarando que la evidencia es un muestreo.
- [ ] 6.4 Implementar el caso de posición desconocida (ventana desde el inicio, declarada) y el de fallo del proveedor al descargar el medio (degradar a muestreo declarándolo).
- [ ] 6.5 Verificar que la ruta de video no interactúa con la página: no reproduce, no pausa, no navega, no altera el registro de referencias del DOM.
- [ ] 6.6 Pruebas: video público con posición conocida, reproductor no direccionable, posición desconocida, video sin transcripción en la página y ausencia de interacción con la página.

## 7. Adjuntos de video y audio

- [ ] 7.1 Ampliar el `accept` del selector de archivos en `src/adapters/desktop_ui/ChatUI.tsx` a los formatos de video y audio admitidos.
- [ ] 7.2 Sustituir la lectura de adjunto de medio por la ruta basada en ruta de disco, sin materializar en el renderer un archivo que supere el presupuesto en línea.
- [ ] 7.3 Implementar el estado visible por adjunto (pendiente, subiendo, procesando, listo, fallido) en el compositor, con reintento y retirada sin perder el texto escrito.
- [ ] 7.4 Implementar la cancelación de subida en curso sin dejar el compositor bloqueado.
- [ ] 7.5 Implementar los rechazos con motivo: formato no admitido, archivo sobre el límite del proveedor, archivo desaparecido antes del envío.
- [ ] 7.6 Implementar los límites por turno: número máximo de medios y duración combinada máxima, con aviso al usuario.
- [ ] 7.7 Pruebas de componente del compositor para cada estado, cada rechazo y cada límite.

## 8. Escucha ambiental

- [ ] 8.1 Extraer de `src/services/meeting-live/audio-capture.ts` la adquisición y el remuestreo reutilizables, sin alterar el comportamiento del pipeline de reuniones.
- [ ] 8.2 Implementar el consumidor de turno: acumular el intervalo y encapsular en WAV mono 16 kHz, con duración máxima configurada.
- [ ] 8.3 Implementar la selección de fuente (sistema o micrófono) con degradación declarada cuando la plataforma no admite la captura de salida y cuando el sistema operativo deniega el permiso.
- [ ] 8.4 Implementar el indicador visible con fuente y tiempo transcurrido, y la detención explícita desde el indicador.
- [ ] 8.5 Implementar el bloqueo de inicio por parte del modelo sin petición explícita del usuario en el turno, devolviendo resultado de herramienta que declara la falta de autorización.
- [ ] 8.6 Implementar el descarte al resolverse o cancelarse el turno, incluida la cancelación de subida en curso, sin escritura persistente.
- [ ] 8.7 Implementar la liberación del dispositivo ante cierre de la aplicación o desaparición del dispositivo, declarando la interrupción.
- [ ] 8.8 Pruebas: límite de duración, detención explícita, fuente no disponible, permiso denegado, inicio no autorizado y descarte tras turno cancelado.

## 9. Prompt, enrutamiento y presupuesto

- [ ] 9.1 Reescribir la sección de visión y navegador de `src/prompts/chat.ts`: condicionar la regla de "no presentar como transmisión continua" a la evidencia por captura, añadir la declaración de intervalo cuando el turno envió video y prohibir pedir la transcripción cuando la ruta de video está disponible.
- [ ] 9.2 Actualizar `src/__tests__/services/chat-prompt-browser-vision.test.ts` a las reglas nuevas y añadir aserciones para las cláusulas de video y de evidencia no utilizable.
- [ ] 9.3 Ampliar el enrutamiento de intención de `send-message-stream.ts` para que las referencias a escenas, personas o acciones dentro de un video no exijan verbos visuales, conservando el adjunto automático por intención como atajo del caso frecuente.
- [ ] 9.4 Añadir los parámetros de presupuesto (ventana máxima de video, umbral de resolución reducida, número y separación de frames, duración máxima de escucha, presupuesto de tokens de medios) como constantes documentadas.
- [ ] 9.5 Añadir el parámetro de runtime que desactiva cada capacidad nueva para el rollback descrito en el diseño.

## 10. Documentación

- [ ] 10.1 Actualizar `docs/architecture/runtime-agents-manual.md`: herramientas nuevas, guardas, límites de medios y la distinción entre evidencia por captura y entrada de video.
- [ ] 10.2 Actualizar `docs/architecture/runtime-parameters.md` con los parámetros de presupuesto y los interruptores de rollback.
- [ ] 10.3 Actualizar `docs/architecture/ipc-and-integrations.md` con los canales `media-input:*` y la ampliación de `integrated-browser:*`.
- [ ] 10.4 Actualizar `docs/security/security-and-privacy.md` con la salida de datos nueva: subida temporal al proveedor, envío de URI de video público, consentimiento, caducidad y no persistencia del audio capturado.
- [ ] 10.5 Actualizar `docs/quality/test-strategy-and-inventory.md` con las pruebas añadidas.
- [ ] 10.6 Actualizar `docs/architecture/technology-stack.md` y `scripts/quality/check-supply-chain.mjs` por el uso de `@google/genai` en la ruta conversacional, y registrar la retirada pendiente de `@google/generative-ai`.

## 11. Verificación y revisión adversarial

- [ ] 11.1 Ejecutar la suite completa de pruebas y el linter, y dejar ambos en verde.
- [ ] 11.2 Verificación manual en el navegador integrado: video público con pregunta sobre la escena sin transcripción abierta, reproductor no direccionable, y contenido protegido por DRM confirmando que se declara y no se describe.
- [ ] 11.3 Verificación manual de adjuntos: video sobre el presupuesto en línea, audio corto, formato no admitido y cancelación de subida.
- [ ] 11.4 Verificación manual de escucha ambiental en cada plataforma disponible, incluida la degradación cuando no hay captura de salida.
- [ ] 11.5 Revisión adversarial del cambio: buscar descripciones no observadas, medios enviados sin consentimiento, referencias caducadas reutilizadas, claves o rutas locales filtradas en errores, y estados parciales del compositor.
- [ ] 11.6 Registrar la evidencia de verificación en `verification.md` del cambio.
