## Why

Todos los webinars de Soflia deben grabarse, pero su disponibilidad posterior en Learning debe depender de la decisión del instructor. La integración actual programa eventos sin exigir grabación automática y no procesa archivos de grabación; hace falta un flujo completo que no dependa del escritorio del instructor.

## What Changes

- Usar Zoom Cloud Recording como grabador principal de los webinars del producto, tanto si la sesión se representa técnicamente como meeting como webinar.
- Exigir y verificar grabación automática al programar e iniciar, con estado real y alertas de ausencia/interrupción. Revisar por separado eventos ya programados.
- Ampliar el webhook existente en Learning para registrar eventos y encolar importaciones duraderas, idempotentes y privadas.
- Importar las grabaciones a almacenamiento privado de vídeo y mantener sus segmentos, procedencia, integridad, retención y capacidad de recuperación.
- Separar grabación obligatoria de publicación voluntaria: grabaciones inicialmente privadas; el instructor autorizado decide si se pueden ver después en Learning.
- Añadir estado de grabación a Hub y catálogo/reproductor autorizado a Learning.

No objetivos: implementar ahora un grabador de pantalla Electron, cambiar Zoom por Video SDK, integrar proveedores Meet/Teams, publicar vídeos automáticamente, añadir IA/transcripción, ni modificar configuración o datos remotos sin autorización operativa.

## Capabilities

### New Capabilities
- `automatic-webinar-recording`: grabación obligatoria por proveedor, preflight, evidencia del estado y recuperación operativa.
- `private-webinar-recording-archive`: recepción fiable, importación privada, segmentos, integridad y retención independiente.
- `learning-webinar-replays`: revisión, publicación explícita y reproducción por alumnos autorizados.

### Modified Capabilities

Ninguna especificación principal archivada se modifica en esta propuesta. Se extiende la integración del cambio activo `implement-live-studio-runtime` sin cambiar su banco local de escenas.

## Impact

Learning: programador Zoom, verificación de acceso, webhook existente, contratos live, persistencia SOFIA, worker duradero, Storage y aula web. Hub: runtime SDK, estado visual y contrato main/IPC/preload/renderer. Zoom: licencias, permisos API/eventos, configuración de grabación y cuota. No se necesita una dependencia de captura local ni un bot de reunión en la primera fase. Los contratos y cinco migraciones SOFIA se implementaron localmente en el checkout coordinado de Learning; su activación y PoC real siguen pendientes.
