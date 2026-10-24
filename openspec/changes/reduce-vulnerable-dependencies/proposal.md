## Why

La consulta npm del 22 de octubre reporta 45 paquetes afectados (20 high y 25 moderate). Existen parches compatibles para procesamiento de imágenes y herramientas de desarrollo que permiten retirar avisos sin rediseñar el sistema.

## What Changes

- Actualizar Sharp, Vite y Vitest/coverage mediante parches de sus líneas actuales.
- Actualizar transitivas seleccionadas dentro de los rangos declarados por sus consumidores; inspeccionar versiones, integridad y ganchos del lock antes de instalar.
- Ejecutar auditoría antes/después, pruebas funcionales y compilación aislada; registrar vulnerabilidades residuales.
- Corregir el filtro del smoke aislado para incluir las entradas de los tres runtimes auxiliares que exige build:app y comprobar sus artefactos.

## Capabilities

### New Capabilities
Ninguna: actualización de implementación y tooling con `skip_specs: true`.

### Modified Capabilities
Ninguna: se conservan contratos funcionales, permisos y datos.

## Impact

Package y lock raíz; documentación y evidencia de dependencias. Se conserva el lock aislado de Zoom. Sin nuevos paquetes directos, canales IPC, tablas, permisos o publicación. Cambios mayores de correo/ONNX/documentos quedan para unidades con contratos propios.
