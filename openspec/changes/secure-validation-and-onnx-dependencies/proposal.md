## Why

Zod raíz 4.4.3 está afectado por consumo excesivo de recursos al validar
colecciones. ONNX Runtime 1.27.0 conserva adm-zip 0.5.18 afectado; hay versiones
publicadas con cierre corregido. La instalación actual y los consumidores
requieren prueba real, además del resultado de npm audit.

## What Changes

- Fijar Zod 4.6.7 y ONNX Runtime 1.30.0, revisar su cierre y hooks antes de instalar.
- Verificar límites y contratos con Zod real, ZIP y modelo ONNX mínimo propio en CPU.
- Comprobar compatibilidad del parser visual y nativo Electron con temporales aislados.
- Registrar auditoría comparable, versiones físicas, gate/build y límites.

No se cambian APIs, esquemas de negocio, modelos, permisos, IPC ni persistencia.
No se fuerza una actualización mayor de Zod en Jimp ni se instalan CUDA/modelos.

## Capabilities

### New Capabilities

Ninguna. Mantenimiento de dependencias y evidencia de compatibilidad; no añade
un contrato funcional. Se declara skip_specs en la metadata del cambio.

### Modified Capabilities

Ninguna. Se conservan requisitos públicos y cuatro capas del sistema.

## Impact

package.json/lock, dependencias instaladas y pruebas de consumidores/tooling.
Documentación canónica de calidad/operación y plan de deuda. No hay SQL,
servicios externos nuevos, secretos o acciones de publicación.
