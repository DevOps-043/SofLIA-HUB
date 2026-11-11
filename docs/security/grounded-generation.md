# Generación con fuentes: autoridad y límites

Estado: vigente. Actualizado: 2026-11-07.

<!-- evidence: electron/ai-grounding-handler.ts -->
<!-- evidence: electron/ai-grounding-service.ts -->
<!-- evidence: src/shared/grounded-generation.ts -->
<!-- evidence: src/shared/grounded-http.ts -->
<!-- evidence: src/services/grounded-generation.ts -->

## Recorrido y compatibilidad

El renderer construye contexto REST y usa el wrapper tipado de investigación.
Preload expone aiGrounding y los canales ai:generate-grounded y
ai:cancel-grounded. El handler valida Hub/Orbe registrados, marco principal,
documento propio e identidad main vigente. El contrato acepta modelName, body y
requestId para cancelar el trabajo del mismo emisor. Llamadas sin ID mantienen
el plazo nativo. Main rechaza campos de credenciales antes de consultar la clave.
La autoridad Gemini valida la sesión Lia vinculada y obtiene la clave en main.
La configuración de main se usa cuando falta una clave personal, según la
política de la autoridad. El renderer Electron omite la consulta de credencial.

Stop, navegación, destrucción o sesión A/B/A cancelan transporte y bloquean
publicación tardía. Una ventana no cancela el trabajo de otra ni una revisión
anterior. Electron falla cerrado si el puente/canal falta, falla o deniega;
no se cambia a HTTP renderer tras ese error. Navegador independiente conserva
transporte explícito; ambos usan endpoint fijo, header x-goog-api-key y límites.
Las claves no viajan en query ni se reflejan errores crudos del proveedor.

Se conservan google_search y url_context; code_execution se admite donde la
política local supportsCodeExecutionCombo ya lo solicitaba. Es ejecución del
proveedor, no shell ni herramienta local. Esto no acredita disponibilidad o
compatibilidad actual del modelo real. El cuerpo admite partes y configuración
REST extensibles dentro de cuotas; el proveedor valida su semántica.

## Cuotas y cancelación

Solicitud completa hasta 320000 bytes UTF-8, profundidad 12, 20000 nodos JSON,
arrays hasta 1000 y objetos hasta 200 claves. Se rechazan getters, prototipos
ajenos y herramientas no admitidas/duplicadas/con campos inesperados. Modelo
hasta 128 caracteres; clave ASCII visible hasta 512, mínimo 20 en main.

Plazo 150 s por intento y respuesta hasta 8 MiB por bytes reales. Se rechazan
redirecciones. Hasta cuatro trabajos por proceso y uno por emisor nativo, sin
cola. La plaza cubre resolución de clave, fetch, lectura y cierre del stream.
Cancelar devuelve control pronto y retiene la plaza hasta el fin físico.
La vigencia se comprueba antes del HTTP y de devolver resultados.
El límite del navegador independiente pertenece a su proceso, no a otras tabs.

El rechazo de autoridad, credencial, payload, cuota o cancelación nativa corta
intentos. Un fallo del proveedor conserva los reintentos de modelo con la
credencial autorizada por main. El navegador independiente conserva intentos
con clave personal y de entorno. Los 150 s se aplican a cada intento. El turno
verifica su vigencia entre intentos y antes de publicar resultados.

## Respuestas y privacidad

Datos dinámicos se tratan como unknown. Texto y partes requieren tipos válidos;
fuentes sólo HTTP(S) sin credenciales embebidas. URL Context con fallo explícito
no acredita una fuente. Los snippets conservan sus índices originales incluso
si un chunk es inválido. Imágenes inline sólo PNG/JPEG/WebP/GIF base64; se
descartan MIME ejecutables. Son controles de formato, no verificación de verdad
de cada afirmación ni clasificación global de contenido.

Los errores/logs nativos son fijos, con duración y correlación; no incluyen
clave, prompt, respuesta ni mensaje crudo del proveedor. La fase de acciones,
el chat general y los especialistas usan el [contrato de conversación Gemini](../architecture/ipc-and-integrations.md#conversación-gemini).
Retirar la configuración pública de credenciales sigue pendiente. Las pruebas
usan puertos y cuentas ficticios. La revisión independiente y la acreditación
con modelos reales quedan pendientes.
