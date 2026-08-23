## 1. Lectura documental e IPC

- [x] 1.1 Añadir al servicio main una extracción de solo lectura del documento activo con verificación de pestaña y URL.
- [x] 1.2 Exponer `integrated-browser:document-read` mediante handler, allowlist/preload y wrapper tipado del renderer.
- [x] 1.3 Declarar y ejecutar `read_active_document` en el catálogo de herramientas del chat con resultado acotado y procedencia no confiable.

## 2. Enrutamiento, memoria y finalización

- [x] 2.1 Reconocer las solicitudes de resumen del documento visible y priorizar la lectura determinista sobre Computer Use.
- [x] 2.2 Aislar la sesión de mensajes recientes por conversación y subordinar memoria histórica a evidencia viva.
- [x] 2.3 Reemplazar los fallbacks de presupuesto agotado de OpenAI y Gemini por un fallo honesto y recuperable.

## 3. Pruebas y documentación

- [x] 3.1 Cubrir servicio, handler, allowlist, wrapper y herramienta con casos de éxito, error y cambio de pestaña.
- [x] 3.2 Añadir regresiones para "Dame un resumen del Documento", "dame un resumen ejecutivo" y memoria de otra conversación.
- [x] 3.3 Actualizar la documentación canónica del agente runtime y de IPC.

## 4. Verificación

- [x] 4.1 Ejecutar pruebas focalizadas, typecheck, lint cambiado, arnés y comprobaciones documentales.
- [x] 4.2 Ejecutar `npm run verify:pr`, registrar evidencia y separar cualquier fallo preexistente.
- [x] 4.3 Realizar revisión adversarial, corregir hallazgos dentro del alcance y registrar riesgo residual.
