## Why

SofLIA solo entiende imágenes fijas. La percepción visual del navegador se reduce a una captura JPEG acotada que el renderer adjunta cuando un heurístico de intención acierta, y el compositor de mensajes únicamente sabe emitir partes `inlineData` a partir de data URLs. No existe ninguna ruta para video ni audio: el repositorio no contiene una sola referencia a `fileData`, `fileUri`, `videoMetadata`, `mediaResolution` ni a la Files API. Cuando el usuario mira un video y pregunta qué ocurre en él, SofLIA depende de que exista una transcripción publicada en el DOM; sin ella responde que no puede ver.

Los modelos Gemini del runtime ya aceptan video y audio como entrada nativa —incluida la URL de un video público procesada del lado servidor a 1 fps con su pista de audio—, de modo que la carencia es de producto, no del proveedor. Cerrarla convierte la observación actual, discreta y fija, en comprensión temporal real de lo que el usuario está viendo y escuchando.

## What Changes

- Ampliar el compositor de contenido del chat para emitir, además de `inlineData`, partes `fileData` con URI remota y metadatos de video (`startOffset`, `endOffset`, `fps`), y para fijar la resolución de medios del turno.
- Migrar el cliente conversacional Gemini de `@google/generative-ai` (descontinuado, sin tipos para metadatos de video ni resolución de medios) a `@google/genai`, ya presente en dependencias y en uso por el actuador Computer Use. **BREAKING** para la forma interna del historial, el streaming y el bucle de herramientas del chat; no cambia el contrato visible del usuario ni el selector de modelos.
- Exponer una herramienta explícita de captura visual del navegador integrado, invocable por el modelo, que fuerza un frame fresco a resolución completa sin depender del heurístico de intención del renderer y sin quedar sujeta a la cadencia multimedia de la observación pasiva.
- Añadir comprensión de video del reproductor activo de la pestaña integrada: cuando el destino es un video público direccionable, el turno envía su URI y una ventana temporal acotada alrededor de la posición de reproducción; cuando no lo es, envía una secuencia de frames muestreados con sus marcas de tiempo.
- Declarar de forma explícita cuándo la evidencia visual no es utilizable —contenido protegido por DRM que devuelve un frame vacío, pestaña oculta, captura fallida— en lugar de describir una escena no observada.
- Aceptar video y audio como adjuntos del chat, subidos por Files API cuando exceden el presupuesto en línea, con estado de procesamiento visible y caducidad gobernada del archivo remoto.
- Permitir que SofLIA escuche bajo demanda el audio del sistema o del micrófono para un turno acotado, reutilizando el pipeline de captura existente de reuniones en vivo, con indicador visible, límite de duración y detención explícita.
- Actualizar el prompt principal y el enrutamiento de intención: la regla vigente que prohíbe presentar la observación como transmisión continua de video pasa a distinguir entre evidencia por captura y entrada de video real, y las referencias del usuario a escenas, personas o acciones dentro de un video dejan de requerir verbos visuales explícitos.
- Acotar el costo por turno mediante resolución de medios seleccionable y ventanas temporales máximas, y registrar en el resultado de la herramienta la ventana efectivamente enviada.

No objetivos: transmisión continua en vivo hacia el modelo sin un turno del usuario o una tarea activa; grabación persistente de video o audio del usuario; eludir DRM o extraer el flujo de medios protegido de una página; generación de video; sustituir la transcripción de reuniones existente; cambiar el proveedor de los modelos OpenAI del catálogo.

## Capabilities

### New Capabilities

- `multimodal-model-input`: construcción de partes multimodales del turno (en línea, archivo remoto y URI de medio público), selección de resolución de medios, ventanas temporales de video, subida y caducidad por Files API, y degradación declarada cuando un medio no puede enviarse.
- `chat-media-attachments`: adjuntar video y audio desde el escritorio al chat, con selección de ruta en línea o subida remota según presupuesto, estado de procesamiento y límites por turno.
- `ambient-audio-capture`: escucha acotada y explícita del audio del sistema o del micrófono para un turno de chat, con indicador, límite de duración y detención por el usuario.

### Modified Capabilities

- `integrated-agent-browser`: la percepción visual deja de ser exclusivamente pasiva y acotada a 1024 px; se añade una captura explícita bajo demanda invocable por el modelo y comprensión del video en reproducción de la pestaña activa, conservando sesión, pestaña y las guardas de acción vigentes.

## Impact

Afecta `src/services/gemini-chat/*` —cliente, historial, streaming, bucle agéntico, resiliencia y compositor de contenido—, el catálogo de herramientas en `src/services/gemini-tools/`, el prompt principal en `src/prompts/chat.ts`, el enrutamiento de intención de `send-message-stream.ts`, el picker y el lector de adjuntos en `src/adapters/desktop_ui/`, y `IntegratedBrowserService` con sus canales `integrated-browser:*`, preload y wrapper tipado. Reutiliza el pipeline de captura de `src/services/meeting-live/audio-capture.ts` y su handler de loopback. Sustituye la dependencia `@google/generative-ai` por `@google/genai` en la ruta conversacional, lo que altera el control de supply chain y obliga a revisar `scripts/quality/check-supply-chain.mjs`.

Introduce una salida de datos nueva: los medios enviados por Files API residen temporalmente en la infraestructura del proveedor hasta su caducidad, y la URI de un video público viaja al proveedor para que lo descargue del lado servidor; ambos casos requieren tratamiento en `docs/security/security-and-privacy.md` y una decisión de consentimiento. La escucha de audio amplía la superficie de captura ya gobernada por permisos del sistema operativo. El costo por turno crece de forma acotada pero real: video a resolución media consume del orden de cientos de tokens por segundo enviado, lo que obliga a ventanas máximas y a resolución seleccionable.

El rollback conserva la ruta de captura fija actual: desactivar las herramientas de video y audio y volver al compositor de solo `inlineData` deja el producto en el comportamiento previo sin migrar datos.
