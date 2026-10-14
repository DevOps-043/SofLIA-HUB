## 1. Preflight y prueba de capacidad

- [x] 1.1 Inventariar sesiones, hosts y módulos de vídeo/worker existentes; ratificar cobertura de webinars del producto en ambas ramas meeting/webinar, excluyendo reuniones ajenas.
- [x] 1.2 Preparar cambio coordinado en Learning, confirmar instancia SOFIA, rutas vigentes, estándares del repo y sincronización de contratos con Hub.
- [ ] 1.3 Consultar licencias/capacidad, configuración, scopes y cuotas de la cuenta/hosts con acceso administrativo autorizado; documentar solo resultado seguro, sin secretos.
- [ ] 1.4 Verificar privacidad/retención del original Zoom, on-demand y correos con enlaces; impedir exposición automática y borrado antes de importar, con política de hosts dedicados aprobada.
- [ ] 1.5 Verificar REST/OpenAPI actual para automático cloud y ejecutar PoC de creación/actualización/readback de Meeting y Webinar en staging con autorización explícita.
- [ ] 1.6 Ensayar captura automática real, SDK anfitrión/participante, aviso, ensayo previo, layout, grabación segmentada y cierre/reconexión de Hub; registrar resultado y archivos de prueba privados.
- [ ] 1.7 Medir una transferencia y reproducción de vídeo real en Storage; fijar runner, protocolo multipart/TUS, tamaño/chunks, RAM, duración, concurrencia y presupuestos de tiempo.
- [ ] 1.8 Acordar cuota, retención privada/publicada, originales Zoom, política de consentimiento y presupuesto; no habilitar producción mientras estos valores carezcan de política.

## 2. Persistencia y contratos aditivos

- [x] 2.1 Diseñar runs/files/jobs/publications sobre entidades existentes o nuevas justificadas, con UUID de instancia, unicidad, auditoría y edición/segmentos.
- [x] 2.2 Preparar migración SOFIA idempotente, FKs, índices y RLS; usar supabase-migration y probar actor, organización, acceso de alumno, escrituras directas denegadas y rollback conservador.
- [x] 2.3 Definir contrato versionado de estado, intención, catálogo y concesión de reproducción; separar URLs de proveedor y secretos de cualquier snapshot público.
- [x] 2.4 Definir ledger/leases/checkpoints y transiciones monotónicas; probar eventos repetidos, orden inverso y carrera entre importación/publicación/retiro.
- [x] 2.5 Aplicar las cinco migraciones en SOFIA/Learning con autorización explícita; verificar dependencias, historial e integridad, RLS, permisos, bucket privado y trigger de protección. Evidencia remota del 2026-10-14 en el reporte de implementación.

## 3. Programación e inicio automático

- [x] 3.1 Extender settings de ambas ramas del programador, preservando reserva, idempotencia, hash de payload, host vinculado y reconciliación/compensación actuales.
- [x] 3.2 Implementar preflight/readback al programar, devolver una reserva idempotente existente y antes de ingreso del anfitrión, con diagnósticos de licencia, permiso, cuota y cifrado incompatibles.
- [x] 3.3 Preparar auditoría/dry-run y backfill de eventos ya programados; aplicar únicamente el conjunto aprobado con log y reintento idempotente.
- [ ] 3.4 Con autorización operativa, configurar automático cloud/restricción de parada para hosts dedicados si se confirmó soporte; verificar que no afecte reuniones externas.

## 4. Webhook y reconciliación

- [x] 4.1 Extender el receptor existente con esquema por evento, límite de cuerpo, HMAC raw/timestamp/cuenta y correlación por sesión/host/UUID.
- [ ] 4.2 Persistir recibo/job antes del ACK rápido; probar firma inválida, timestamp viejo, cuenta ajena, almacenamiento caído, evento huérfano y duplicados.
- [x] 4.3 Implementar reconciliación API paginada, encoding de UUID y recuperación de metadatos/credenciales vencidas, con rate limit, checkpoint y presupuesto.
- [x] 4.4 Registrar recording.started/stopped/completed y ausencia de grabación; evitar que eventos tardíos reabran runs o publiquen contenido.

## 5. Archivo privado y procesamiento

- [x] 5.1 Implementar worker duradero con lease, límites, backpressure y cancelación; reusar el runner existente cuando cumpla el contrato.
- [x] 5.2 Validar URL/redirect/MIME y usar autorización en headers; bloquear SSRF, hosts no permitidos y propagación de tokens a otros orígenes.
- [x] 5.3 Transferir por partes con checkpoints, tamaño/hash y validación de duración/audio/vídeo; confirmar asset privado solo al finalizar, con recuperación de uploads parciales.
- [x] 5.4 Construir edición/playlist de segmentos y selección de layout, conservando cobertura y huecos; reconciliar fin del evento antes de marcar edición completa.
- [x] 5.5 Implementar retención propia, ledger de purga, hold, límites y métricas; comprobar que GC de estudio/materiales no elimine grabaciones del archivo.

## 6. Estado de grabación en Hub

- [x] 6.1 Observar recording-change en runtime SDK y enviar estado por el bridge de ventana/origen/nonce existente; comprobar arranque, pausa/parada, reconexión y limpieza de listeners.
- [x] 6.2 Sincronizar estado autorizado desde Learning; integrar mediante servicio main, handler validado, preload allowlisted y wrapper renderer, sin nuevas APIs genéricas.
- [x] 6.3 Mostrar Preparada/Grabando/Interrumpida/Procesando/Lista/Error, aviso a participantes y recuperación acotada del host si PoC validó record(start); no presentar éxito de comando como archivo listo.
- [ ] 6.4 Probar ausencia de evento, error SDK, rol insuficiente, cambio de cuenta/sesión y regreso a Hub con webinar todavía activo.

## 7. Repetición opcional en Learning

- [x] 7.1 Implementar intención antes del evento y publicación/retiro después, validando instructor, audiencia y revisión; desactivada por defecto e independiente de grabación.
- [x] 7.2 Aplicar intención vigente únicamente a edición final íntegra; revalidar rol y evitar publicación por primer segmento, callback duplicado o job tardío tras retirar; exigir revisión específica de huecos, ensayo o cobertura incierta.
- [x] 7.3 Incorporar panel de revisión del instructor y catálogo de repeticiones publicadas para alumnos, con estados pendiente/no disponible y cobertura visible.
- [x] 7.4 Implementar concesiones de reproducción de vigencia acotada, renovación autorizada y Range/seek/segmentos; probar organización ajena, membresía retirada y URL vencida.
- [x] 7.5 Validar UI profesional en español, teclado y accesibilidad; no enviar notificaciones externas ni publicar enlaces de Zoom automáticamente.

## 8. Validación, entrega y rollout

- [ ] 8.1 Ensayar E2E de staging con instructor/alumno: webinar grabado pero privado, intención anterior, publicación posterior, retiro, reingreso y grabación con Hub cerrado.
- [ ] 8.2 Probar fallos de proveedor/red/worker/Storage, cuota agotada, token vencido, evento perdido, recurrencias, ensayos y segmentos parciales; medir recursos y cobertura real.
- [ ] 8.3 Ejecutar verify-change en ambos repositorios, contratos sincronizados, docs y gates aplicables; revisar adversarialmente permisos, carreras, pérdidas y rutas sin verificar.
- [x] 8.4 Actualizar documentación de arquitectura/contratos/operación/parámetros, runbook de soporte y evidencia reproducible bajo este cambio y su cambio coordinado de Learning.
- [ ] 8.5 Con aprobación de despliegue, activar flags por organización y observar esperado/grabado/importado/publicado, latencia y cuota; ensayar rollback sin borrar archivos ni retirar política de grabación.

La implementación local está preparada. Las casillas pendientes corresponden
a la cuenta/capacidad real, PoC audiovisual, operaciones externas y entrega final.
Las pruebas locales no acreditan captura Zoom, capacidad Storage ni despliegue.
Las tareas de código marcadas incluyen contratos, implementación y pruebas locales;
sus escenarios reales se ensayan en 1.3–1.8 y 8.1–8.2 antes de producción.
