## Context
La clave en memoria se compartía globalmente sin partición por proveedor ni
usuario. Se evita almacenamiento persistente y se observa la sesión durante la
consulta; eventos de auth y operaciones de modificación revocan consultas activas.

## Decisions
Conservar la fachada `getApiKeyWithCache` para compatibilidad y consultar por
proveedor cada vez. Cada operación suscribe antes de RPC y libera al terminar;
la invalidación usa una revisión local. No hacer llamadas asíncronas dentro del
callback de auth. Rechaza la operación si la consulta dejó de ser vigente, impidiendo que el consumidor use el fallback de entorno en una sesión distinta.

## Risks
El cambio introduce más consultas RPC. No evita que una clave ya entregada o un
I/O iniciado sigan vivos, ni evita el uso del fallback de entorno, ni sustituye
las garantías del servidor. La revisión independiente queda pendiente.
