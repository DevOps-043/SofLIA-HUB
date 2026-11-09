## Why

El contrato global Window de automatización contiene 78 usos de any y repite definiciones de preload y main. Los resultados HTTP de nodos se usan como objetos sin comprobarlos, por lo que el compilador no detecta deriva de contratos o metadata inválida.

## What Changes

- Centralizar DTO puros y firmas de las tres APIs a partir de los productores existentes, manteniendo canales y formatos válidos.
- Usar esos contratos en main/preload/renderer y retirar casts de wrappers que sustituyen comprobaciones.
- Tratar respuestas dinámicas como objetos de valores desconocidos, validar la frontera remota y comprobar metadata antes de actualizarla.
- **BREAKING de seguridad:** resultados de herramientas conversacionales de estado/listado/registro retiran el campo token y exponen sólo token_configured; la API manual de ajustes conserva sus campos. El tipado reveló que el token se reenviaba a contexto de modelo en ambos recorridos runtime (main/WhatsApp y renderer).
- Probar contratos positivos/negativos y consumidores, medir disminución de lint y verificar el lote una sola vez con cobertura.

## Capabilities

### New Capabilities

- `automation-bridge-contracts`: contratos compartidos comprobables de automatización y rechazo de respuestas remotas estructuralmente inválidas.

### Modified Capabilities

Ninguna.

## Impact

Tipos compartidos, interfaces nativas/preload, wrappers y cliente remoto. Sin canales, dependencias, UI o datos nuevos. Tipar no cierra autorización/HITL/custodia de nodos; hallazgos y límites en el [contexto](context-pack.md).
