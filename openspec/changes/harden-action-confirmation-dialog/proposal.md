## Why

La confirmación de acciones anuncia aria-modal pero no mueve/restaura foco ni
atiende Escape. Un foco anterior o una solicitud reemplazada puede dejar la
revisión de permisos separada del control que recibe el teclado.

## What Changes

- Usar diálogo nativo controlado, foco seguro, Escape y devolución del foco.
- Renovar foco/lectura cuando cambie la solicitud, incluso con texto idéntico.
- Mantener contenido largo accesible con scroll, zoom y movimiento reducido.
- Delegar la decisión al resolver dueño existente; no borrar otra solicitud
desde un callback obsoleto de la capa de presentación.
- Verificar renderer y Electron real. Compartir preparación del arnés renderer
con el selector existente manteniendo su comando y alcance.

No modifica autorizaciones, aprobación permanente, IPC, datos o dependencias.
No migra otros diálogos ni certifica accesibilidad global.

## Capabilities

### New Capabilities
- `action-confirmation-dialog`: modalidad, foco e identidad de revisión del chat.

### Modified Capabilities

Ninguna especificación vigente cambia su autorización pública.

## Impact

ConfirmActionModal y ChatModals en renderer, props privadas y arnés de QA.
La confirmación/ejecución main, preload y servicios de autorización conservan
sus contratos. No ejecuta acciones reales ni modifica configuración local.
