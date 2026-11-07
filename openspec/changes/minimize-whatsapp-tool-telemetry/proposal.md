## Why

El historial operativo de WhatsApp persiste argumentos de herramientas, mensajes y errores del proveedor como telemetría; las excepciones del dispatcher también pueden filtrar contenido privado. Las mismas estructuras mezclan diagnóstico persistente y comparación interna de ciclos.

## What Changes

- Proyección cerrada de eventos de herramientas: estados, flags, contadores y referencias de correlación, sin argumentos/mensajes/errores crudos.
- Aplicar la proyección al escribir y al leer eventos tool heredados, preservando bytes antiguos y eventos de conversación.
- Comparaciones efímeras con huellas por turno y resumen tipado; conservar avances y comportamiento de guardas de repetición.
- Excepciones inesperadas saneadas en dispatcher/fallback/guardas y aislamiento de un fallo del registro después de efectos.
- Documentar límites del legado e historial conversacional; probar disco real temporal, loop, fallos y privacidad.

## Capabilities

### New Capabilities
- `whatsapp-tool-telemetry-privacy`: minimización de registros operativos y errores seguros sin alterar resultados funcionales de herramientas.

### Modified Capabilities
Ninguna. Canales IPC, catálogo y permisos se conservan.

## Impact

Loop/agente WhatsApp, dispatcher, store de historial, tipos internos, pruebas y documentación. Sin dependencias, canales, SQL ni permisos nuevos. Los archivos heredados no se modifican y el contenido normal de conversación no se elimina por este cambio.
