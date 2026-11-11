## Context

OpenAI ya tiene inferencia Responses nativa, herramientas y proveedor de equipos.
El inventario detecta inferencia Google en chat, agentes, reuniones, memoria,
control visual, imágenes, medios y servicios auxiliares.

## Decisions

El usuario confirmó distribución sólo de escritorio. Flow e imágenes requieren
sus puentes nativos; se retiran las rutas web que utilizaban claves del cliente.
La compatibilidad standalone no implica añadir un backend nuevo.

Imágenes usa Images de OpenAI con modelo fijo y salida PNG validada. Flow usa
Responses para análisis/fallback y Audio para dictado. Conservan los límites de
plazas físicas, sesión, documento, ventana y tamaño del contrato anterior.
Los especialistas y utilidades de texto usan Responses sin herramientas ni
almacenamiento; el timeout aborta la inferencia y descarta resultados tardíos.

La clasificación/extracción de reuniones y las tareas JSON del workspace usan
Responses con formato JSON y el cliente nativo compartido de sesión. Este cliente
vive en `electron/ai-provider/`, fija el endpoint oficial y no admite una
respuesta RPC malformada como ausencia de clave. Conserva revocación y descarte
de respuestas al cambiar la sesión. La extracción mantiene clasificación previa,
normalización, evidencia y aprobación humana; las tareas mantienen validación
del schema. No conservan setters ni clientes Google de estas capacidades.

El controlador visual usa un catálogo de funciones Responses validado en main.
Mantiene las coordenadas normalizadas, la confirmación nativa, la verificación
visual y la cancelación de los drivers. Sólo se reenvía la captura más reciente.
La preferencia persistida del motor anterior se traduce a OpenAI al cargarla.

El audio de mensajería y Flow comparte el adaptador Audio de OpenAI. Se conserva
el contenedor de cada entrada compatible y se rechazan formatos sin soporte
explícito. Falta convertir AAC crudo y cerrar la paridad de adjuntos de chat.

Los vectores nuevos llevan el identificador del modelo de embeddings. En el
navegador se conserva la preferencia de consentimiento y se reconstruye el índice
desde historial y marcadores con el botón existente. En memoria conversacional
las filas antiguas conservan su texto y quedan fuera de la búsqueda vectorial.
Queda pendiente reindexarlas bajo la sesión y el alcance originales.

Retirar Gemini del catálogo y migrar selecciones guardadas al modelo OpenAI por
defecto, conservando el razonamiento compatible del usuario. Los equipos nuevos
usan OpenAI. Su proveedor revalida el modelo antes de iniciar una llamada.
Las variables de credenciales se excluyen de renderer y preload. Se retira el
paso de claves por las props de ajustes. Las integraciones Google Workspace
conservan sus propios contratos de autorización, ajenos a la inferencia.

La retirada continúa por capacidades hasta eliminar SDK, endpoints, handlers y
rutas heredadas, con pruebas de cada consumidor. Los documentos históricos se
mantienen identificados como evidencia temporal del estado anterior.

## Risks / Trade-offs

Las selecciones retiradas se convierten a SofLIA por defecto. Los artefactos y
trabajos históricos requieren reconciliación al recuperar la cola. Cada capacidad
multimodal debe migrarse de manera explícita antes de retirar su dependencia.

## Migration Plan

Aplicar catálogo y preferencia, equipos, servicios multimodales, agentes y
herramientas, retirar código inalcanzable y dependencias, validar build y gate.
Revertir la unidad afectada desde su respaldo si falla su contrato. Conservar
las demás modificaciones locales.
