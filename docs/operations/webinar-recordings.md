# Grabación y repeticiones de webinars

Estado: implementación local coordinada con Learning; activación pendiente.

Soflia utiliza anfitriones Zoom centrales; el instructor no vincula ni paga una
cuenta individual. La plataforma debe disponer de capacidad cloud/webinar.
Todos los eventos nuevos del aula requieren automático cloud. La fuente de verdad
del archivo, autorización, trabajos y publicación es Learning/SOFIA.

El runtime SDK observa recording-change y transmite solo estados validados por
ventana, origen y nonce. Un comando aceptado no significa Grabando ni archivo listo.
Pausa/parada muestra interrupción; el estado ready confirma copia privada en Soflia.
Participantes ven el aviso y el instructor controla Permitir ver después en Learning.
No existe un interruptor docente para desactivar la política de grabación.
La recuperación SDK de inicio queda detrás de aprobación de su PoC.

El contrato recordings se transporta por learning-live:studio y las cuatro capas
existentes, sin nueva API genérica del preload. Main verifica actor/sesión/edición
y URLs efímeras exclusivamente del bucket privado live-recordings de Supabase.
El snapshot no recibe credenciales administrativas, IDs Zoom ni object_keys;
la concesión de vídeo solo lleva las URLs firmadas necesarias para reproducirlo.
El SDK está aislado y nunca recibe credenciales de Storage.

La fuente del contrato es Learning; el sincronizador incluye
live-studio.contract.ts, live-studio-domain.ts y recordings/contract.ts.
LEARNING_CHECKOUT señala el checkout durante desarrollo, sin dependencia externa
en el paquete entregado.

El procedimiento operativo canónico del servidor está en el repositorio Learning,
docs/live-recordings.md. Incluye las cinco migraciones SOFIA, anfitriones centrales,
privacidad/retención Zoom, S3, FFprobe, proceso duradero, cuotas, purga/hold,
reconciliación, scripts de mantenimiento y rollback sin borrar vídeos.
No se activó producción ni se ejecutaron operaciones administrativas remotas.

Revisión y evidencia de este cambio: [reporte de grabaciones](../../openspec/changes/record-webinars-and-publish-replays/reports/implementation.md).
El estudio conserva su [operación previa](live-studio-runtime.md) y sus vínculos
locales de escenas; grabar solo captura lo efectivamente emitido al proveedor.
