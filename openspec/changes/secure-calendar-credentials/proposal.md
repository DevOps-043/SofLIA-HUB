## Why

El calendario guarda OAuth en JSON plano y conserva conexiones al cambiar la identidad del Hub. Como Gmail, Drive y Chat comparten esa autenticación, cerrar esta brecha reduce riesgo transversal sin sustituir los módulos.

## What Changes

- Cifrar credenciales por usuario con custodia del SO y escritura atómica; rechazar almacenamiento inseguro.
- Sellar el archivo heredado de forma recuperable y restaurar sólo registros con propietario exacto; nunca atribuir conexiones sin dueño.
- Vincular el servicio a la sesión de main y descartar restauraciones, OAuth, renovaciones y polling tardíos.
- Mantener los canales, DTO y APIs públicas existentes, probando sus consumidores integrados.

## Capabilities

### New Capabilities
- calendar-credential-custody: credenciales cifradas y aislamiento por identidad, incluida transición heredada.

### Modified Capabilities
Ninguna especificación principal existente cambia.

## Impact

Servicio de calendario, persistencia, OAuth, consultas/polling y pruebas. Las capas handler/preload/wrapper se conservan. Sin tablas, canales, dependencias ni despliegue. Los perfiles heredados sin propietario necesitan reconectar; no se eliminan datos ni se leen secretos reales durante desarrollo.
