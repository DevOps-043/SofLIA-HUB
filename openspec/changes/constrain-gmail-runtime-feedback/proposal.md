## Why

Modificar un mensaje en WhatsApp activa una verificación global que ordena al modelo seguir vaciando toda la etiqueta. El resultado sintético carece de llamada correspondiente y arrastra estado Gmail por ejecutores no relacionados, además de registrar IDs y errores privados.

## What Changes

- Retirar el verificador que consulta etiquetas completas y fabrica una instrucción/resultado adicional.
- Eliminar bulkLabelsToVerify de los contratos internos de loop, dispatch y ejecutores Google; conservar sus resultados y capas.
- Preservar una respuesta real por llamada, con orden, resultados parciales, cancelación e incertidumbre del servicio.
- Conservar tokens/flags de paginación sin órdenes de leer todos los resultados y rechazar respuestas extra en el adaptador del proveedor sin elevarlas a mensaje user.
- Probar flujo integrado y correspondencia con call_id, y mantener permisos/grupos/HITL existentes.

## Capabilities

### New Capabilities
- `gmail-runtime-feedback-scope`: resultados Gmail acotados a llamadas reales, sin vaciado ni verificación global implícitos.

### Modified Capabilities
Ninguna. Los contratos IPC y los servicios de buzón/planes/envío no cambian.

## Impact

Loop y dispatcher WhatsApp, ejecutores Google y sus tipos internos; fixtures, pruebas y manual runtime. Sin dependencias, canales, persistencia, credenciales o permisos nuevos. Se usa la verificación ya implementada en servicios, sin duplicar ni sustituir sus resultados. No se envían mensajes ni se consulta un buzón real.
