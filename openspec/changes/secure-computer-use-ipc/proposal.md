## Why

Computer Use admite llamadas IPC heterogéneas sin validar fuente ni argumentos;
la aprobación renderer puede omitirse. Esto expone capacidades nativas y dificulta
mantener contratos comprobables entre las cuatro capas.

## What Changes

- Autorizar Hub/Orbe, marco/documento y revisión de sesión en todas las llamadas.
- Validar snapshots acotados con schemas por operación y retirar any del registro.
- Confirmar efectos en main, ligados a argumentos; acotar trabajos físicos y diálogo.
- Evitar doble confirmación renderer sólo para herramientas cubiertas por main.
- Conservar respuestas/progresos únicamente mientras la autoridad siga vigente.

## Capabilities

### New Capabilities

- `computer-use-ipc-authority`: fuente, entradas, aprobación y trabajos acotados.

### Modified Capabilities

Ninguna especificación canónica modificada.

## Impact

Registro computer, startup, shared, preload y confirmación renderer; mismas APIs y
canales, sin dependencias ni migraciones. Sin ejecución real de efectos/GUI.
Rutas internas y Desktop Agent conservan sus contratos y pendientes propios.
