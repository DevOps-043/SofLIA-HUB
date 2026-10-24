## Why

La sesión cifrada de Project Hub no identifica a su propietario. Restore, canje, renovación y logout pueden competir y aplicar respuestas antiguas. El cliente también sigue redirecciones con cuerpos de autenticación y vuelve a enviar mutaciones después de 401, pese a retry=false. Cifrar bytes no resuelve esas brechas de ciclo de vida.

## What Changes

- Separar custodia, contexto de identidad, autenticación y transporte de la fachada integrada.
- Persistir por propietario mediante cifrado asíncrono del SO y reemplazo privado serializado.
- Invalidar operaciones pendientes por cambios de identidad, logout y autenticación sustituida; cerrar estado local antes de esperar revocación.
- Acotar HTTP/envelopes, bloquear redirecciones, validar credenciales y sanear fallos; sólo GET puede repetirse automáticamente.
- Mantener contratos existentes y probar store/disco, concurrencia y HTTP local real sin cuentas reales.

## Capabilities

### New Capabilities
- `project-hub-session-custody`: credenciales por propietario y autenticación/solicitudes invalidables.

### Modified Capabilities
Ninguna. La fachada y los canales conservan entradas/salidas; el legado sin dueño requiere nuevo canje y deja de restaurarse implícitamente.

## Impact

Main Project Hub, pruebas, smoke de custodia y documentación. Sin dependencias, canales, SQL ni despliegues nuevos. Persisten permisos del servidor y frontera IPC/HITL por reforzar; no se declara seguridad integral ni porcentaje global nuevo.
