## Why

La frontera IPC de Project Hub permite invocación cuando no hay ventana registrada y no comprueba marco principal/origen ni confirmación humana de escrituras. Cifrar la sesión no evita que una aprobación o respuesta se use después de navegar o cambiar actor.

## What Changes

- Denegar callers no vigentes con el helper común de Electron y liberar sus listeners.
- Compartir schemas tipados, estrictos y acotados para las operaciones v1 existentes.
- Exigir confirmación nativa de cada mutación IPC, con destino y alcance de datos visibles; rechazar approved del payload como sustituto.
- Propagar autorización/cancelación hasta el servicio y HTTP, impedir envío después de cambiar caller y reportar incertidumbre de efectos ya iniciados.
- Preservar rutas, consumidores, allowlist y custodia, con pruebas de las cuatro capas.

## Capabilities

### New Capabilities
- `project-hub-ipc-authorization`: caller, payload, HITL y contexto de ejecución para la superficie IPC existente.

### Modified Capabilities
Ninguna. No se agregan canales ni capacidades remotas.

## Impact

Handler, contrato compartido, parámetros opcionales internos del servicio/auth, preload y wrapper renderer tipados, pruebas y documentación. Sin dependencias, SQL, despliegue ni borrado de proyectos. No certifica autorización/RLS del servidor ni retira accesos directos heredados.
