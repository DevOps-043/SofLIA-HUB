## Context

Ver [investigación y código inspeccionado](research.md). El backend Learning ya
programa ambos tipos Zoom y verifica eventos firmados. Hub aloja Meeting SDK 6.5.0.
El estado académico vive en SOFIA; fuentes y escenas de producción siguen locales.
La duración aceptada actualmente por scheduleSchema es 15–480 minutos.
No se consultaron licencias, permisos, cuotas ni ajustes de la cuenta real.

## Goals / Non-Goals

**Goals:** que los eventos del producto tengan una grabación verificable, un
archivo privado recuperable y acceso posterior gobernado por Learning. Diseñar
el flujo para seguir funcionando si Hub se cierra mientras Zoom continúa activo.

**Non-Goals:** registrar pantallas no compartidas, capturar escenas solo preparadas
en el Hub, prometer continuidad cuando el webinar realmente termina, grabar
reuniones ajenas a Soflia, duplicar el backend de vídeo si ya existe, o desarrollar
un grabador local/bot. La implementación local fue autorizada posteriormente; las mutaciones remotas siguen pendientes.

## Decisions

### DEC-WREC-001 Proveedor cloud, archivo propio

Zoom Cloud Recording será el grabador principal, sujeto a prueba de capacidad
de la cuenta. Learning archivará sus vídeos en almacenamiento privado propio.
Se descarta capturar la ventana de Zoom desde Electron como solución inicial:
añadiría dependencia de equipo/disco/audio local y no acreditaría grabación de
toda la emisión. Un enlace compartido de Zoom tampoco reemplaza el control
académico del reproductor propio. No cambiar a Video SDK para obtener grabación.

La identidad docente permanece en Soflia. ZOOM_PLATFORM_HOST_IDS configura el pool central; reservas transaccionales evitan solapamientos, incluidas sesiones programadas previamente. Las licencias las administra la plataforma, nunca el docente.

### DEC-WREC-002 Política obligatoria dentro del producto

La política del servidor exige grabar los webinars del aula, soportando ambas
ramas técnicas meeting/webinar. La primera fase ratifica qué eventos de la
organización se consideran webinars; no afecta encuentros de Zoom externos a
Soflia. El instructor no recibe un interruptor para desactivar esta política.

Al programar, establecer grabación cloud en settings del evento. El candidato
de contrato REST es `settings.automatic_recording = 'cloud'`: confirmar ese
payload con el OpenAPI y un POST/PATCH real de staging para cada tipo antes de
implementarlo. No inferir grabación efectiva porque el request fue aceptado:
releer configuración y registrar el resultado del preflight.

Comprobar host vinculado, licencia/capacidad, scopes, cuota y compatibilidad de
cifrado antes de habilitar ingreso del anfitrión desde Soflia. La prevalidación
servidor impide enseñar un evento incompatible como preparado; fuera del Hub,
el proveedor puede admitir accesos distintos, por lo que la política operativa
de hosts dedicados debe acompañar a la validación del producto.
Aplicar también al camino idempotente que devuelve una sesión ya programada:
un request previo exitoso no prueba la configuración de grabación actual.

Auditar eventos existentes y preparar backfill idempotente con vista previa de
qué se modificará. No cambiar indiscriminadamente toda la cuenta Zoom. Evaluar
grupo dedicado con automático cloud y restricción de pausa/parada cuando la
cuenta lo permita. Cambios remotos requieren autorización de administración.

### DEC-WREC-003 Evidencia de captura separada de éxito de comando

Usar los estados propuestos `required`, `armed`, `starting`, `recording`,
`interrupted`, `processing`, `importing`, `ready`, `failed`, `missing` para cada
ejecución. La interfaz muestra Grabando solo con observación del proveedor;
una firma SDK válida, una escena ligada, un botón pulsado o meeting.started no
constituyen prueba de grabación.

El SDK observará recording-change y comunicará el estado al padre con la misma
ventana/origen/nonce existente. El backend es la autoridad persistente, mediante
webhooks y reconciliación. Evaluar `client.record('start')` como recuperación
acotada del anfitrión autorizado; no añadir pausa/parada al instructor si la
política exige grabación continua. El resultado de ese comando no sustituye
recording-change/recording.started. Si no arranca o se interrumpe, mostrar aviso
operativo y registrar el intervalo; ninguna recuperación reconstruye contenido
que nunca se grabó. No prometer cumplimiento 100% frente a fallos del proveedor.

### DEC-WREC-004 Reutilizar webhook y custodiar jobs duraderos

Extender el receptor existente `apps/web/src/app/api/internal/jobs/zoom-live/route.ts`
sin crear un segundo receptor Zoom. Conservar HMAC del cuerpo original, comparación
constante, frescura del timestamp y filtro de cuenta. Añadir esquema por tipo de
evento y límite de cuerpo; no perder uuid/archivos por el esquema anterior.

Aceptar recording.started/stopped/completed y los eventos adicionales disponibles
que se confirmen en staging. Resolver sesión por cuenta, tipo, ID remoto y host
registrados, luego asociar UUID de instancia. No relacionar por título, correo
libre ni un número remoto sin organización. Un evento huérfano queda aislado para
revisión; no crea contenido público.

Persistir recibo normalizado y job en transacción antes del ACK rápido. Si no se
puede conservar, devolver fallo para permitir redelivery. El webhook no descarga
ni convierte vídeo. Usar ledger/cola Postgres con unicidad y leases, reutilizando
un mecanismo existente si cumple ese contrato. Un worker duradero fuera del ciclo
de respuesta Next.js ejecuta las transferencias; si no hay runner existente,
añadir un consumidor limitado del ledger de este feature, sin un framework genérico.

Clave de idempotencia propuesta: proveedor + account_id + UUID de instancia +
file_id + versión de procesamiento. Los eventos pueden duplicarse o llegar fuera
de orden; un evento de inicio tardío no reabre una ejecución finalizada. Las
reconciliaciones usan fecha/tipo/host/UUID y checkpoint paginado, no solo el ID
numérico de una reunión recurrente. Confirmar encoding de UUID en el cliente API.

### DEC-WREC-005 Importación privada y segmentada

Consultar metadatos autorizados y descargar solo artefactos de la instancia
registrada. Tokens únicamente en headers y custodia servidor; si vencen, obtener
autorización fresca por API. No persistir URLs con secretos en un snapshot/renderer.
Validar HTTPS, dominios/rutas permitidos y cada redirección, sin reenviar Authorization
a un host distinto. No admitir URLs arbitrarias recibidas desde el cliente.

Copiar con backpressure, chunks/reanudación, hash y checkpoints por archivo. No usar
`arrayBuffer()` de un webinar ni cargar GB en una función web. Crear objetos en área
de staging privada y confirmar el asset final tras validar tamaño, MIME real,
duración, legibilidad y audio cuando corresponda. Un upload parcial nunca es ready.
Abortar/limpiar multiparts abandonados mediante un ledger de reintento.

Conservar segmentos y layouts del proveedor; elegir como reproducción principal
pantalla + presentador cuando esté disponible, con fallback de layout declarado,
no de otra sesión. Evitar duplicar todos los layouts sin un caso de uso. Un
webinar puede producir varios archivos por paradas/reinicios: construir una
edición ordenada o playlist de segmentos; no publicar solo el primer MP4.
Los huecos e intervalos de interrupción quedan visibles para revisión.

Proveedor inicial de archivo: Supabase Storage privado existente, **con bucket
de vídeo y contrato de subida dedicado**, después de verificar capacidad y módulos
de vídeo previos. Usar API S3 multipart o TUS según capacidades comprobadas del
worker; no la subida de materiales de 25 MB. [Opciones oficiales](https://supabase.com/docs/guides/storage/uploads/s3-uploads).
Si cuota/rendimiento no cumplen la PoC, resolver almacenamiento dedicado antes
del rollout, manteniendo custodia Learning y el mismo contrato de asset.

### DEC-WREC-006 Grabar, archivar y publicar son estados distintos

Cada webinar se graba y se importa privado independientemente de la preferencia
de repetición. Propuesta de estado de publicación: `private`, `requested`,
`published`, `withdrawn`. La opción Ver después en Learning está desactivada por
defecto. El instructor puede activarla antes del evento o publicar después de
revisar el vídeo; no se le exige un segundo permiso si ya autorizó esa publicación.

Una preferencia anterior es intención de publicar, no acceso inmediato. Solo
publicar cuando la ejecución esté finalizada, se hayan reconciliado segmentos y
la edición esté validada; revalidar rol, organización, audiencia y la última
revisión de la preferencia en una transacción. El evento completed inicial puede
preceder al fin del webinar si alguien detuvo/reinició grabación: no publicar ahí.
Si se desactiva la repetición o pierde permiso el instructor, una importación
tardía no puede volver a publicarla. No promover futuras versiones/segmentos
sobre una edición publicada sin aplicar la política de revisión del conjunto.
Si hay huecos de captura, ensayo incluido o cobertura incierta, no publicar por
la intención genérica anterior: requerir revisión de esa edición y una decisión
explícita sobre su cobertura. Esto no repite el consentimiento de una edición
completa; distingue un resultado distinto del que se había autorizado.

La privacidad debe abarcar el original en Zoom: verificar y desactivar
compartición/publicación automática, on-demand y notificaciones con enlaces de
acceso a asistentes que puedan eludir la política académica. Configurar el grupo
dedicado según permisos disponibles, sin inventar nombres de settings REST.
Un bucket privado propio no corrige un original que el proveedor ya publicó.

Vista propuesta: panel del instructor con estado real, vídeo, cobertura, duración,
segmentos y acción de disponibilidad; alumno con acceso solo a repeticiones
publicadas del curso/organización autorizados. Aviso de grabación a participantes
y reglas de consentimiento de la organización; no captura oculta.
Un ensayo previo no se publica por inferencia: PoC verifica límites del ensayo
y se conserva una marca editorial si forma parte del archivo.

### DEC-WREC-007 Persistencia y contratos propuestos

Reutilizar metadatos de sesión y módulos de vídeo existentes tras inventario.
Si faltan, estos nombres son **propuestas**, no tablas/rutas existentes:

| Entidad propuesta | Responsabilidad |
| --- | --- |
| live_recording_runs | Sesión/organización/host, proveedor, UUID de ejecución, estado/cobertura y relación con edición |
| live_recording_files | file_id remoto, segmentos/layout, object key privada, bytes/duración/hash y validación |
| live_recording_jobs | Ingesta, lease, intentos, checkpoint y diagnóstico seguro |
| live_recording_preferences | Intención por sesión, revisión y actor |
| live_recording_policies | Cuota, retención y habilitación organizacional de repeticiones |
| live_recording_artifacts | Reserva de cuota y ledger de objetos pendientes/confirmados |
| live_recording_audit | Publicación/retiro y purga auditables |
| live_recording_cursors / live_recording_session_ends | Checkpoint paginado y cierre independiente del orden de callbacks |

Publicación/revisión/retiro son campos del run; no se creó una tabla duplicada de publicaciones. Cinco migraciones aditivas SOFIA, FKs e índices por consulta, unicidad de instancia/archivo,
RLS sin exposición pública, worker con credencial server-only y endpoint que
revalida acceso académico. No permitir escritura directa authenticated de estado
de importación o éxito. Catalogar antes de registrar estos nombres definitivamente.

API propuesta bajo el feature live: listar/consultar estado, configurar repetición,
publicar/retirar una edición, solicitar reproducción y reintentar importación por
rol autorizado. Definir payloads estrictos/versionados y responses controladas.
Hub puede ampliar contrato studio para estado y preferencia y sincronizarlo desde
Learning; un canal adicional se justifica solo si ese contrato no cubre el uso.
Siempre servicio main, handler validado, preload allowlisted y wrapper tipado.
SDK nunca recibe OAuth administrativo, service_role, URLs de descarga ni bucket keys.

### DEC-WREC-008 Reproducción, retención y presupuestos

Generar acceso efímero al vídeo solo después de comprobar edición publicada,
organización, curso y membresía vigente. Reproductor con Range/seek, subtítulos
si posteriormente se autorizan, soporte de segmentos y estados no disponible.
No exponer share_url de Zoom como control de acceso del aula.

Propuesta inicial: URLs de reproducción de hasta 120 segundos, renovadas tras
revalidación. Retirar impide nuevas concesiones inmediatamente; una URL ya emitida
puede funcionar hasta vencer y un cliente conserva bytes ya descargados. Si se
requiere revocación de cada petición, usar entrega autenticada en lugar de prometer
revocación instantánea de una URL firmada.

Retención independiente de live_studio_assets/GC del aula, para no borrar vídeos
publicados cuando termine la sesión. Acordar retención de privados/publicados,
original en Zoom, copias parciales, cuotas y presupuesto de egress antes de
producción. No inferir almacenamiento perpetuo de la orden grabar todos.
No eliminar el original de Zoom hasta confirmar copia íntegra y política aprobada.
Verificar además que la retención automática del proveedor deje margen suficiente
para procesamiento e importación; la aplicación no puede evitar por sí sola un
borrado manual/automático efectuado fuera de Soflia. Registrar esa pérdida como
incidencia recuperable solo si existe otra copia íntegra.
Purgas siguen política administrativa autorizada, auditoría y legal hold cuando
corresponda; borrados manuales requieren confirmación explícita.

Parámetros iniciales propuestos para PoC, no garantías: máximo dos transferencias
globales y una por organización; webhook hasta 1 MiB; lease renovable con cancelación;
reintentos con backoff/jitter y máximo de intentos antes de revisión. Medir RAM/CPU,
tiempos, bytes, cuotas y volumen con webinars reales antes de fijar producción.
El tamaño máximo y chunks dependen del contrato multipart/TUS verificado y se
centralizan en configuración. No hay polling nuevo en renderer; reconciliación
de backend acotada al ciclo del evento, con jobs sin solapamiento y alertas.

## Risks / Trade-offs

- Licencia/scopes/cuota insuficientes → preflight bloquea preparación compatible;
  prueba real obligatoria y diagnóstico operativo, sin fallback local simulado.
- Fallo del proveedor o comienzo tardío → aviso, cobertura/gaps y recuperación
  acotada; no afirmar que se recuperó audio/vídeo que no existe.
- Reutilización de ID Zoom, duplicados o orden inverso → UUID por ejecución,
  correlación autorizada, ledger único y transiciones monotónicas.
- Worker caído o token vencido → job persistente, lease, checkpoint y autorización
  nueva; reconciliar ausencia de callback sin depender del instructor conectado.
- Descarga SSRF o fuga de token → URL/redirect validados, origen acotado,
  headers y redacción de secretos; ningún enlace de proveedor llega al alumno.
- Publicación de prueba/ensayo o segmentos incompletos → fin del evento,
  reconciliación de edición, marcas de cobertura y decisión del instructor.
- Original público o correos on-demand de Zoom → privacidad del proveedor
  comprobada antes de rollout; no depender únicamente de RLS del archivo propio.
- Eventos atrasados vuelven a publicar → intención con revisión vigente y CAS;
  reintentos de importación no modifican la intención del instructor.
- Grabaciones largas y coste doble Zoom/Storage → transferir por partes, medir
  volumen/costo y acordar retención; no usar el límite de materiales de clase.
- Cierre del host que termina el webinar → el proveedor finaliza la grabación;
  no confundir salir de Hub con que Zoom necesariamente siga activo.

## Migration Plan

1. PoC con cuenta/host autorizados y preflight real. Verificar Meetings y Webinars,
   auto cloud, SDK, aviso, layout, ensayo, duración, storage y permisos mínimos.
2. Crear ledger/persistencia/worker aditivos y extender el webhook existente detrás
   de feature flag. Validar RLS, firmas, jobs, fallos y rollback sin borrar datos.
3. Configurar grabación de eventos nuevos; auditar y aplicar backfill aprobado a
   existentes. No activar por defecto grabación de otras reuniones de la cuenta.
4. Ensayar de extremo a extremo con curso de staging: captura, cierre/reconexión
   Hub, procesamiento, importación íntegra y privacidad. Primero archivo privado.
5. Habilitar preferencia de repetición/catálogo/reproductor por organización;
   publicar con actor/audiencia/revisión verificables.
6. Documentar monitoreo, incidencias, cuota, retención y operación; rollout gradual
   y medición de grabaciones esperadas contra verificadas/importadas.

Rollback: desactivar publicación/nuevas importaciones mediante flags, conservar
ledger/assets y reconciliar jobs en vuelo. Mantener política de grabación cloud
si el requisito sigue vigente; no borrar vídeos ni desactivar automático como
efecto secundario del rollback de UI. Una retirada de política requiere decisión
administrativa explícita.

## Open Questions

Configuración operativa por cerrar en fase 0: licencias/scopes efectivos, límites
de Storage, volumen real, plazos de retención y presupuesto, runner del worker,
layout final, tiempos de alerta/procesamiento y cobertura de ensayos. Son entradas
del rollout y PoC, no capacidades afirmadas ni permisos concedidos en esta tarea.
Si la PoC niega cloud o archivo privado, volver a la decisión de arquitectura
antes de implementar: no sustituir el plan automáticamente por captura local.

## Estado de implementación

Código y comprobaciones locales: [reporte](reports/implementation.md). Se mantiene el gate operativo: cuenta real, privacidad, medios, Storage y presupuesto requieren PoC autorizada. replay_enabled y retention_approved empiezan false. La recuperación SDK requiere verificación separada.
