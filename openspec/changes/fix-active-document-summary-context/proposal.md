## Why

El chat puede interpretar "el documento" como una orden genérica de Computer Use sin leer el documento visible, agotar su bucle y mostrar un falso éxito. En el turno siguiente, la memoria compartida entre conversaciones puede sustituir la evidencia ausente y producir un resumen de una fuente anterior.

## What Changes

- Reconocer solicitudes de lectura o resumen del documento visible como contexto de la pestaña activa.
- Exponer al agente de chat una lectura semántica, completa y de solo lectura del documento activo, reutilizando la extracción autenticada de Google Docs y validando identidad de pestaña, URL y título.
- Separar la memoria conversacional por conversación y tratar la memoria histórica como contexto secundario cuando existe evidencia viva de una fuente.
- Sustituir el mensaje de falso éxito al agotar el bucle por un resultado honesto y accionable.
- Añadir pruebas de regresión para las frases exactas observadas y para evitar contaminación desde documentos anteriores.

No se editará el documento, no se ampliarán permisos de navegación y no se borrará ni migrará la memoria histórica existente.

## Capabilities

### New Capabilities

- `grounded-active-document-chat`: Lectura y resumen verificable del documento activo, aislamiento del contexto conversacional y finalización honesta del bucle.

### Modified Capabilities

Ninguna.

## Impact

- Renderer: enrutamiento del chat, catálogo/ejecución de herramientas, contexto de memoria y contratos tipados del navegador integrado.
- Electron main/preload: extracción documental de solo lectura y canal `integrated-browser:*` con validación existente de sender.
- Datos: cambia la clave de sesión usada para nuevos turnos de memoria; no modifica registros existentes.
- Documentación y pruebas del agente runtime, navegador integrado e IPC.
- Sin dependencias nuevas, sin acciones críticas y sin HITL adicional porque la capacidad es estrictamente de lectura.
