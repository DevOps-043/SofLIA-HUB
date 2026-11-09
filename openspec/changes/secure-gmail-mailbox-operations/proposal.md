## Why

Nueve canales Gmail todavía no validan caller ni payload y seis mutan sin confirmación main. El vaciado masivo puede repetir una página, ocultar avances o declarar éxito con errores; además se filtran errores y metadatos privados en logs.

## What Changes

- Contratos cerrados y tipados para lectura, etiquetas, papelera y lotes; identidad derivada de main y confirmación contextual antes de efectos.
- Contexto de ejecución común con planes para fijar cuenta/cliente, validar esperas y propagar cancelación/timeout sin retry; exclusión de mutaciones por cuenta.
- Seleccionar mensajes antes de mutar para no depender de un listado que se altera durante el proceso; validar precondiciones de borrado y conservar conteos parciales.
- Errores públicos genéricos, logs sin payload y pruebas de caller, paginación, SDK, cancelación y fallos parciales.
- **BREAKING**: operaciones masivas fuera de cuota, referencias no válidas y opciones ambiguas se rechazan antes de mutar; las fallidas dejan de anunciar éxito o cero avances.

## Capabilities

### New Capabilities
- `gmail-mailbox-authorization`: autorización, contratos y resultados honestos de lectura y mutación del buzón.

### Modified Capabilities
Ninguna. Planes y envío conservan sus contratos y módulos existentes.

## Impact

Servicio Gmail y sus módulos, contexto compartido con planes, nueve handlers, preload y wrappers, documentación y pruebas. Sin dependencias ni canales nuevos, sin SQL ni cambios de secretos. No se ejecuta correo real. La recuperación durable de planes permanece separada; las operaciones directas no prometen reversión tras un crash.
