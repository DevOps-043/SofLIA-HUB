## Why

El coordinador del navegador conserva siete campos para temporización y cierre de sesión, con reinicios repetidos. Esa responsabilidad puede mantenerse y verificarse como una unidad sin depender de vistas Electron.

## What Changes

- Concentrar guardado automático, última escritura y checkpoint de cierre en un módulo del navegador.
- Mantener en el coordinador la construcción de la sesión, recuperación, perfil y limpieza de recursos.
- Verificar concurrencia, errores y cancelación mediante contratos y las pruebas existentes de integración.

## Capabilities

### New Capabilities
Ninguna: refactorización interna con `skip_specs: true`.

### Modified Capabilities
Ninguna: permanecen iguales los requisitos de sesión, permisos y recuperación.

## Impact

Servicio y persistencia del navegador integrado, pruebas, smoke nativo y documentación de arquitectura. Sin cambios de API pública, IPC, formato de archivos, dependencias o UI. Las demás responsabilidades del coordinador quedan fuera de esta unidad.
