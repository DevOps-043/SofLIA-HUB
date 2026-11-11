## Why

La compuerta aprueba pruebas sin medir cobertura de producción ni exigir umbrales, y CI/release aún usan referencias mutables de Actions. Son brechas transversales que permiten mejorar más alcance por una sola verificación completa, como pidió el usuario.

## What Changes

- Medir cobertura V8 de toda producción TS/TSX, incluidos archivos no importados, y convertir el resultado en control efectivo de PR/release.
- Fijar pisos verificables a partir de la medición, publicar reportes y evitar ejecutar la misma suite dos veces en el gate.
- Fijar Actions remotas a SHA completo verificado en sus repositorios oficiales y bloquear futuras referencias mutables mediante política local y pruebas negativas.
- Actualizar documentación, evidencia y reevaluación del índice con el mismo método de 44 criterios.

## Capabilities

### New Capabilities

- `global-quality-gates`: cobertura de producción comprobable y dependencias de workflows inmutables verificadas antes de entregar.

### Modified Capabilities

Ninguna.

## Impact

Configuración Vitest, scripts de verificación, workflows, documentación y reportes. Sin cambios de producto, contratos IPC/datos, credenciales o dependencias nuevas. No acredita firma, notarización o ejecución remota de CI. [Contexto](context-pack.md).
