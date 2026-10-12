## Why

La rama main quedó detrás de ramas de trabajo con mejoras complementarias.
El usuario solicita reconciliarlas conservando la evolución actual y preparar
la versión 0.9.9 con notas claras para quienes instalan el producto.

## What Changes

- Integrar las ramas recientes y resolver contratos y pruebas compartidos.
- Reconciliar las ramas históricas preservando sus commits y documentando los
  cambios sustituidos o inseguros que no se reactivan.
- Recuperar los arreglos vigentes de actualización y captura enfocada.
- Actualizar versión, changelog e inventarios documentales derivados.

## Capabilities

### New Capabilities

- `release-branch-integration`: trazabilidad y verificación de la integración.

### Modified Capabilities

Ninguna capacidad adicional a las ya especificadas por las ramas integradas.

## Impact

Git, main/preload/renderer, pruebas y documentación. No se ejecutan migraciones
remotas, no se modifican secretos y no se publica un instalador ni una etiqueta.
