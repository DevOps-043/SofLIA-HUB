## Why

El handler de generación con fuentes no valida emisor/sesión ni limita físicamente HTTP. Stop sólo abandona la espera renderer y algunos rechazos IPC activan fetch directo; el validador main tampoco admite code_execution que sus consumidores ya solicitan.

## What Changes

- Contrato JSON acotado y herramientas cerradas según política local existente, con claves/errores fuera de logs.
- Autorizar Hub/Orbe, revalidar identidad y documento tras esperas y agregar cancelación ligada al trabajo/emisor.
- Servicio HTTP con deadline, bytes reales, redirect denegado y concurrencia acotada; preservar búsqueda, URLs y gráficas existentes.
- **BREAKING de seguridad:** Electron no cambia a HTTP directo tras rechazo o puente ausente. Navegador independiente conserva su ruta explícita con los mismos límites.
- Tipar preload/wrapper y estrechar respuestas desconocidas; pruebas causales e integradas y documentación.

## Capabilities

### New Capabilities

- `grounded-generation-authorization`: generación con fuentes bajo autoridad nativa, cuotas y cancelación verificables.

### Modified Capabilities

Ninguna.

## Impact

Servicio/handler IA, preload/allowlist, bootstrap, contratos compartidos, wrapper/consumidores renderer y pruebas/documentación. No cambia persistencia ni dependencias, no expone shell/herramientas de desarrollo ni ejecuta modelos reales. Custodia global de claves renderer sigue pendiente.
