## Why

Las aulas embebidas heredan las licencias y límites del anfitrión de Meeting SDK.
El usuario autorizó migrar a Video SDK para cursos largos y sesiones paralelas
facturadas por consumo, conservando la experiencia y permisos de Soflia.

## What Changes

- Incorporar ingreso Video SDK firmado por Learning y runtime aislado con controles en español.
- Elegir proveedor al programar; preservar las reuniones existentes y evitar cambiar una clase activa de transporte.
- Programar nuevas sesiones Video SDK sin reservar anfitriones de Meetings; validar cuenta y grabación automática.
- Adaptar cierre, reconciliación REST y transferencia de grabaciones al worker privado existente.
- Documentar configuración, consumo, migración y validación real pendiente.
- No incluye compras, cambios de secretos, aplicación de SQL remoto ni despliegue.

## Capabilities

### New Capabilities
- `zoom-video-sessions`: acceso autorizado, medios, proveedor persistente y grabaciones Video SDK compatibles con el aula.

### Modified Capabilities
Ninguna especificación principal existente; los contratos del estudio se amplían manteniendo compatibilidad.

## Impact

Hub: paquetes del runtime, frame y contrato sincronizado, servicio/handler existente, CSP y pruebas.
Learning: programación, firma, cierre, proveedor REST y worker de grabaciones, migración aditiva SOFIA.
Dependencia nueva: `@zoom/videosdk` 2.6.0, licencia del proveedor revisada y lockfile aislado con scripts deshabilitados.
