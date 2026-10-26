# Project Hub unificado

Estado: acceso directo a IRIS desde Electron main; validación con cuentas reales pendiente. Actualizado: 2026-10-24.

## Límites de dominio

Project Hub/IRIS es la fuente de verdad de proyectos nuevos, tareas, miembros, evidencia compartida y analítica. Lia conserva carpetas de chats, conversaciones, transcripciones completas, minutas y decisiones de aprobación. Solo cruzan hacia IRIS resúmenes aprobados, hashes, referencias y extractos breves.

Las carpetas existentes aparecen como **Carpetas heredadas** y no se migran. La sección **Proyectos** usa los clientes Supabase existentes desde main, sin contactar al servidor web de Project Hub ni canjear su sesión. El registro se crea directamente en IRIS y su propietario forma parte de esa misma escritura.

## Creación contextual y ubicación

Nuevo proyecto abre un `dialog` en la ventana principal mediante portal al body. El formulario no muestra organización ni workspace. La asignación interna sigue resolviendo el workspace por `workspaces.sofia_org_id`, comprobando primero la sesión y membresía activa en Learning y el contexto de organización de main; la lista continúa aislada por organización. Si falla, la creación queda bloqueada; no se infiere la relación por nombre o posición.

Elegir carpeta y Añadir carpeta abren `dialog.showOpenDialog` con la ventana principal como padre y `openDirectory/createDirectory`. Electron presenta el selector nativo de Windows, macOS o Linux; se retiró el explorador local construido con React. Cancelar conserva el borrador y la selección anterior. Main convierte el resultado en una selección opaca, vigente durante quince minutos, y revalida propietario, ruta canónica e identidad del directorio. El renderer no puede mandar rutas arbitrarias para crear proyectos.

Las ubicaciones nuevas son Local, Google Drive y OneDrive. Local crea una subcarpeta exclusiva y el manifiesto `.soflia/project.json`. Google Drive reutiliza la cuenta Google vinculada; OneDrive utiliza la misma cuenta Microsoft, con permiso delegado de archivos separado del calendario. Ambos permiten elegir carpeta y crean la subcarpeta directamente mediante la API del proveedor. Las selecciones remotas también son opacas y quedan vinculadas a usuario, cuenta y proveedor. Hasta diez carpetas locales adicionales quedan vinculadas sin copiar, indexar ni publicar contenido.

Archivos del proyecto consulta su ubicación y guarda allí la selección nativa, con revisión de destino y formatos/límites existentes de hasta diez archivos y 20 MiB por archivo. Local publica una copia exclusiva tras staging; Google usa Drive v3 y OneDrive sesiones de subida con conflicto `fail`. Los bytes no pasan por Storage de Soflia ni por el renderer. Las referencias de evidencia y los archivos históricos mantienen su dominio; el botón de subida heredado se retiró de la vista formal. La etiqueta antigua `cloud` se puede leer para identificar configuraciones previas, pero no sirve como destino nuevo ni se reasigna silenciosamente a una cuenta.

La ubicación y los recibos permanecen cifrados por usuario/proyecto en `project-locations`, bajo userData. La autorización de OneDrive usa MSAL público, PKCE, state, validación de cuenta y caché cifrada separada; no sustituye las credenciales del calendario. Un resultado incierto no se reenvía ni borra carpetas como compensación. No hay transacción entre disco, proveedor y base de datos, ni conciliación automática. El manifiesto no concede permisos.

Los canales son `resolve-organization`, `select-folder`, `cloud-accounts`, `authorize-cloud`, `cloud-folders`, `create-cloud-folder`, `create-configured`, `get-location`, `location-files`, `upload-location-files` y `cancel-location-upload` bajo `project-hub`. Exigen ventana principal, sesión y payload cerrado. Las autorizaciones y los selectores sólo se abren tras la acción humana. La superficie web nativa se oculta temporalmente ante el diálogo. El registro de negocio sigue en Project Hub/IRIS; esta elección configura dónde viven los archivos, no elimina la base de datos de tareas, miembros o proyectos.

Sin cuenta vinculada, Drive y OneDrive quedan deshabilitados con «Inicia sesión para continuar»; durante la consulta también se bloquean. Sus logotipos oficiales se distribuyen como recursos locales, con origen documentado en `public/brands/README.md`. El selector remoto permite crear una carpeta mediante una selección opaca del padre y una acción humana explícita; no repite la escritura ante un resultado incierto. El selector local conserva la opción nativa de nueva carpeta.

La creación guarda `team_id: null` si no se indica equipo y valida cualquier equipo explícito dentro del mismo workspace. No depende de `TEAM_REQUIRED` ni de un despliegue del servidor web. Después de un rechazo confirmado de negocio, un reintento local explícito puede reutilizar la misma operación y carpeta preparada, comprobando destino, organización y manifiesto intacto; una operación incierta sigue bloqueada.

## Conexión directa vigente

### Tablero y lista de tareas

El panel abre en Tablero, con las fases Backlog, Pendientes, Por hacer, En curso, En revisión, Completadas y Canceladas, tarjetas de responsable/dificultad/fecha y contadores de las tareas cargadas. Cada fase conserva los estados reales del equipo, sus IDs y nombres; los estados personalizados adicionales también permanecen visibles. Pendientes se distingue por nombre y puede compartir el tipo persistido `todo` con Por hacer. Lista usa las mismas tareas y filtros; cambiar de vista no reinicia la consulta. Una fase sin configuración se presenta vacía sin creación ni destino de arrastre; nunca se envían IDs artificiales a la base. El menú lateral usa iconos propios con siluetas diferenciadas y cada fase tiene un indicador SVG específico, con los tokens de tema existentes.

La barra compacta filtra búsqueda, estado, responsable, dificultad y ciclo. Actualizar recarga tanto las tareas como las opciones; limpiar retira todos los filtros. La búsqueda espera 200 ms y cada consulta queda asociada a una clave de proyecto/filtros, para descartar respuestas antiguas. La paginación mantiene el alcance y los filtros y señala que los recuentos parciales corresponden a tareas cargadas.

La dificultad usa `estimate_points`: sin estimar para nulo, baja hasta dos puntos, media mayor de dos y hasta cinco, alta mayor de cinco. El editor selecciona dos, cinco u ocho puntos y conserva valores existentes si no cambia esa selección. `priority_id` permanece separado y se conserva al editar; no se renombra ni se usa para simular dificultad. El filtro compartido `difficulty` se valida en el canal existente y la consulta directa lo aplica antes de paginar; no requiere tablas, columnas ni canales nuevos.

Crear desde una columna precarga su estado. El arrastre sólo está habilitado para quien puede escribir y envía `status_id` junto con `expected_updated_at`, conservando la confirmación main. No actualiza visualmente el estado antes de confirmar la escritura; cancelar o un resultado incierto conserva la ubicación anterior y no reenvía la mutación. Por teclado se abre el detalle y se cambia su selector Estado. Un lector mantiene acceso al detalle sin acciones de escritura.

Implementación y evidencia en [el cambio de tablero](../../openspec/changes/redesign-task-board/proposal.md).

### Sesión y acceso a datos

`getProjectHubApiService()` conserva su nombre por compatibilidad de los canales y consumidores; su instancia de producción utiliza `DirectProjectBackend`. Las rutas del adaptador son identificadores internos, sin solicitudes HTTP a Project Hub. `auth:set-state` verifica la sesión SOFIA y ya no inicia su canje web. `npm run dev` inicia la aplicación directamente sin comprobar ni levantar ese servidor.

Antes de consultar IRIS, main exige la identidad SOFIA verificada, selección de organización vigente y `organization_users.status=active`. Comprueba `organizations.is_active`, resuelve `workspaces.sofia_org_id` y verifica su membresía activa. Si falta un espejo de organización, perfil o membresía, lo sincroniza desde los datos comprobados de Learning mediante los clientes existentes; no reactiva un espacio o membresía deshabilitados ni sustituye un rol IRIS existente.

Cada operación limita el workspace al contexto activo y comprueba acceso al proyecto por administración del espacio, propiedad o membresía activa. Las mutaciones mantienen la confirmación existente y sus roles de escritura/administración. A/B/A y cambios de organización invalidan el resultado, incluidos los cambios durante una espera. No hay fallback al servidor web. Las lecturas llevan límites y paginación; no se inventan totales cuando no cabe calcularlos completos.

La propiedad del proyecto se registra en `created_by_user_id`; las lecturas la presentan como integrante propietario sin exigir una segunda inserción. Los colaboradores adicionales se guardan en `pm_project_members`. Tareas, hitos, documentos, miembros y referencias usan las tablas existentes; tareas siguen necesitando equipo/estados. Una operación compuesta puede dejar un efecto parcial y devuelve `uncertain/recoveryRequired`, sin compensar con borrados ni reenviar automáticamente. La importación de reuniones usa únicamente el RPC transaccional existente: si los permisos de la base no lo permiten, informa el error y no usa una clave de servicio ni cambia grants.

Los archivos nuevos permanecen en equipo/Drive/OneDrive. Las descargas históricas consultan metadatos y solicitan una URL firmada directamente a Storage, con las validaciones de contenido/destino existentes. La subida heredada a Storage no se activa en esta instancia.

Este cambio no modifica políticas RLS, grants ni secretos. La autorización de main cubre estos canales; no corrige los accesos heredados ni demuestra aislamiento global de la base. La [auditoría IRIS](../reports/iris-access-2026-10-22.md) conserva sus hallazgos y requiere una remediación separada. La disponibilidad del esquema y permisos desplegados se valida por respuesta de la base, sin ejecutar migraciones automáticamente.

Implementación y criterios en [el cambio de creación](../../openspec/changes/redesign-project-creation/proposal.md).

## Autenticación web anterior (referencia histórica)

Las secciones de autenticación HTTP y custodia siguientes describen el adaptador anterior, conservado para compatibilidad y pruebas de contrato con un endpoint explícito. No describen la instancia de producción directa del Hub.

1. El renderer restaura o inicia la sesión SOFIA.
2. `auth:set-state` entrega los tokens SOFIA a main para verificar su sesión; el access token se usa también en el canje Project Hub.
3. Main llama `POST /api/v1/auth/sofia/exchange`; Project Hub verifica el token con SOFIA, sincroniza identidad/workspaces y emite tokens propios.
4. El access token queda solo en memoria. El refresh token y los workspaces se cifran mediante el backend seguro del SO en archivos separados por propietario. Main exige que su usuario coincida con la identidad verificada de la sesión SOFIA; el modo compatible de `auth:set-state` por sí solo no abre la custodia.
5. El cliente renueva en single-flight por contexto y descarta respuestas anteriores a un cambio de identidad, logout o canje posterior. Solo GET admite recuperación automática de autenticación y reintentos acotados de red. Las mutaciones no se reenvían automáticamente, incluso si llevan `Idempotency-Key`; un reintento de dominio requiere su propio contrato.

La fachada `service.ts` conserva las rutas y consumidores. `authentication.ts`
coordina identidad/canje/renovación, `transport.ts` aplica límites HTTP y
`session-store.ts` reutiliza `storage/os-cipher.ts` y `storage/private-files.ts`.
No se crean canales IPC. Sin identidad, el status interno devuelve workspaces vacíos sin
abrir archivos ni contactar al servidor. Durante operaciones se suscriben cambios
main: A/B/A también invalida la respuesta. La carga del módulo SOFIA se comparte;
el resultado de su getter de identidad se consulta al capturar y revalidar cada
operación, incluso si main aún conserva el usuario anterior.

Logout invalida memoria y encola la retirada del archivo antes de esperar una
revocación remota, usando sólo el token capturado al iniciarse. No se garantiza
que el servidor revoque JWT ni que una mutación ya enviada pueda cancelarse.
Falla de custodia mantiene esa sesión sólo en memoria, con aviso seguro.

El archivo global heredado `project-hub-session.enc` carece de propietario
verificable: se conserva sin leerlo, adjudicarlo ni usarlo como fallback. La
sesión nueva se obtiene con el canje SOFIA. Esto no acredita eliminación física
ni remediación del cifrado de los bytes antiguos. El formato nuevo incluye
versión y propietario interno; copiarlo a otro usuario se rechaza. La cola es
local al proceso y no pretende bloquear escritores de otros procesos.

HTTP rechaza redirects y bases con credenciales, query o fragmento; permite
HTTPS o HTTP sólo para loopback explícito. Los errores públicos tienen mensajes
propios sin cuerpos/códigos remotos libres. Los límites están en
[parámetros runtime](runtime-parameters.md#sesiones-y-http-de-project-hub).
La [unidad de custodia](../../openspec/changes/secure-project-hub-session-custody/proposal.md)
registra pruebas de disco, concurrencia, HTTP local y DPAPI. La custodia no
certifica la autorización/RLS ni la API desplegada.

## Autorización IPC

La validación de caller y payload sigue vigente. Las menciones al canje y roles del servidor web en esta sección corresponden a la etapa anterior; la autorización directa vigente se describe arriba.

Los 23 canales existentes sólo aceptan el marco principal no separado de la
ventana main registrada, objeto WebContents exacto, documento de la aplicación
y sesión vigente. Ausencia de proveedor/ventana deniega. No se amplía esta
superficie a la orbe. Incluso status IPC requiere caller válido; el status
interno vacío sigue disponible al ciclo de autenticación main.

`src/shared/project-hub.ts` reúne schemas/tipos para handler, preload y wrapper.
Cada llamada comprueba aridad exacta y snapshot JSON acotado, independiente del
objeto original. Se rechazan campos de dominio desconocidos, prototipos,
accesores, ciclos y valores fuera de JSON; metadata se admite como JSON dentro
de la misma cuota. Los schemas derivan del código local del servidor v1, sin
afirmar que ese código esté desplegado.

Las diez mutaciones de dominio, la subida y la copia local piden confirmación, cancelar por defecto,
vigencia de 120 segundos y un diálogo pendiente por registro. Antes se comprueba
sesión/workspace y, cuando existe, identidad/nombre del proyecto con una lectura
autorizada. El destino no se etiqueta desde el payload. Un workspace nuevo no
incluido en la sesión exige repetir el canje; la lista local no sustituye roles
efectivos del servidor. La aprobación muestra usuario, destino, operación y
selección; textos grandes/listas se resumen y se indica que se comparten
completos. `approved=true` de una reunión no sustituye el diálogo. La subida
aprueba un lote nativo; intención/PUT/complete permanecen dentro de esa operación.

El último argumento opcional de los métodos main conserva autorización del
caller; nunca cruza desde renderer. Se revalida tras esperas y combina señales
con la identidad. Cancelar retira la espera y listeners del caller aunque siga
pendiente la custodia; la renovación del propietario puede continuar para otros
consumidores. No se envía negocio desde el caller cancelado. Navegación, crash,
destrucción y A/B/A invalidan confirmación/resultado. Una mutación invocada que
pierde su contexto o queda sin respuesta verificable informa
`uncertain/recoveryRequired`, conservadoramente, sin certificar envío ni rollback.

Pruebas y límites en la
[unidad IPC](../../openspec/changes/secure-project-hub-ipc/proposal.md).
Persisten permisos/revocación del servidor y accesos IRIS directos.
Estas unidades no acreditan una prueba humana
de diálogos nativos, un instalador ni seguridad integral de todos los IPC.

La superficie v1 no entrega tokens Project Hub al renderer y está en `electron/project-hub/`, `electron/project-hub-handlers.ts`, `electron/preload/project-hub-api.ts` y `src/services/project-hub-api.ts`. Subsisten accesos directos heredados en `src/services/iris-data/` y `electron/iris/`; no quedan protegidos por el canje v1. La [inspección de permisos efectivos](../reports/iris-access-2026-10-22.md) confirma que requieren transición autorizada y rollout de servidor antes de retirar sus permisos. El contrato v1 local no expone borrado de proyectos.

## Subida nativa de archivos

Este es el protocolo heredado de evidencia. La vista formal de archivos utiliza ahora la ubicación local, Drive u OneDrive descrita arriba; no expone este botón de carga como destino de los proyectos nuevos. El contrato se conserva para compatibilidad con consumidores anteriores y no se migran ni eliminan archivos históricos en esta corrección.

`project-hub:upload-files` recibe sólo workspaceId/projectId/operationId UUID;
`cancel-upload` sólo operationId. Sustituyen create-upload-intent/complete-upload
en preload/allowlist. Sus métodos main conservan el protocolo interno v1. No
se reciben rutas ni bytes del renderer ni se devuelven URLs/tokens de subida.
El único consumidor UI utiliza selector nativo y cancela al cambiar proyecto,
desmontarse o solicitarlo explícitamente; descarta resultados de la vista anterior.

Main comprueba destino, selecciona 1–10 archivos sin truncar, inspecciona todos
y presenta nombres/MIME/tamaños/hashes para aprobar. Abre archivos regulares,
comprueba lstat/fstat y conserva handles hasta cerrar. Calcula hash por bloques;
tras aprobar relee un archivo a la vez y exige los bytes/tamaño aprobados.
Extensión/MIME y firmas se comprueban localmente; texto debe ser UTF-8 sin NUL.
ZIP de OOXML no constituye análisis de estructura ni antivirus. El servidor
conserva validación final de bytes/MIME/tamaño/hash.

Por archivo se pide una intención y se comprueba respuesta única, evidence UUID,
path workspace/proyecto/evidence.ext y URL exacta de project-files. El origen
permitido proviene de VITE_IRIS_SUPABASE_URL pública en main, nunca de la
respuesta. HTTPS salvo loopback explícito configurado, sin userinfo/fragmento
ni query adicional; token de query igual al token devuelto. PUT sin cookies,
bearer de sesión, redirects ni retries. Sólo tras PUT exitoso se solicita
complete; sólo cuenta confirmado si la respuesta devuelve el mismo destino y
metadata.upload_state=ready.

Una operación de archivo activa por registro, compartida con descarga;
cancelar un selector pendiente conserva el bloqueo
hasta que se cierre. La confirmación comparte exclusión con el resto de
mutaciones Project Hub. Caller/sesión/operación invalidan lectura/red. Los
contadores requested/prepared/stored/uploaded distinguen intención, PUT y
validación final; un fallo conserva confirmados y comunica pendientes o
incertidumbre. No se repite el lote automáticamente ni se borran huérfanos.
No hay diario/reanudación tras reiniciar. Límites y evidencia en
[parámetros](runtime-parameters.md#sesiones-y-http-de-project-hub) y la
[unidad de subida](../../openspec/changes/secure-project-hub-file-uploads/proposal.md).

## Copia local de archivos

`download-file` recibe workspaceId/projectId/evidenceId/operationId UUID;
`cancel-download` sólo operationId. Sustituyen `get-download` en las cuatro
capas públicas. El protocolo getDownload sigue dentro de main: ninguna URL
firmada, token, ruta local ni bytes del archivo llega al renderer.

Main captura la sesión durante todo el flujo y consulta evidencia autorizada:
upload ready sin archivar, IDs, MIME/extensión, tamaño, SHA-256 y storage_path
exactos. Presenta archivo/hash/tamaño y proyecto comprobado en confirmación
nativa compartida, y luego permite elegir un nombre nuevo con SaveDialog.
El nombre sugerido se sanea; nunca se interpreta una ruta remota como destino.

La URL se pide después de elegir destino. Sólo acepta el origen configurado de
Storage, object/sign/project-files y path de la evidencia, un token y TTL
válidos. GET de bytes sin bearer/cookies, redirects ni retry; límite real,
longitud exacta, hash y formato compartido con subida antes de publicar. Esto
no certifica antivirus ni estructura completa de documentos OOXML.

Se crea un staging exclusivo modo 0600 en el directorio elegido, se sincroniza
y se publica con hard link exclusivo. No se sobrescriben colisiones ni se abre
el archivo. Un filesystem sin hard links falla sin publicar una copia parcial.
Se revalida directorio/contexto antes de publicar; sólo se retira el staging
propio. Crash o cleanup fallido pueden dejar `.soflia-download-*.part`; no hay
barrido ni reanudación automática. No se garantiza seguridad frente a un actor
con control de escritura del mismo directorio/usuario del SO.

Cancelar compara tipo/id/actor/WebContents/frame y conserva el slot hasta que
termine el trabajo o cierre el selector. Si la copia se publicó antes de cambiar
contexto, el resultado conserva saved=true/bytes y requiere revisar el destino;
cancelar no elimina una copia aprobada.
Si link falla sin confirmar publicación, uncertain/recoveryRequired piden
revisar el destino aunque haya cancelación; saved=false no acredita ausencia
de copia cuando el resultado es incierto. El hook cancela al desmontar/cambiar
proyecto y descarta resultados anteriores. La vista se remonta por destino para
retirar listas/acciones antiguas. Otros flujos asíncronos de la vista conservan
su revisión pendiente. Límites en [parámetros](runtime-parameters.md#sesiones-y-http-de-project-hub)
y evidencia en la [unidad de descarga](../../openspec/changes/secure-project-hub-file-downloads/proposal.md).

## Experiencia de proyecto

La vista formal abre un apartado en la superficie principal con el lateral flotante del Hub. Sus secciones verticales son Resumen, Tareas, Archivos, Páginas web, Chats del proyecto, Hitos, Ciclos, Equipos, Métricas y Actividad; no usa tabs para navegar el proyecto. El panel consume tareas completas, evidencia, documentos vinculados, hitos, equipo principal, ciclos del equipo y analítica. Sus estados de error distinguen falta de datos de ausencia de recursos. Los estados sin sesión, API caída y reintento son explícitos. Archivos, Drive, enlaces e investigaciones del navegador se anexan como evidencia; las colecciones son versiones inmutables. La composición y tipografía se documentan en [frontend](frontend.md).

El lateral ofrece Nuevo chat y navegador dentro del contexto del proyecto. La compatibilidad de conversaciones lee el vínculo existente de Lia y exige una carpeta accesible; si no existe tabla/vínculo, muestra el límite y bloquea creación sin convertirla en un chat global. No crea carpetas como efecto de abrir el panel ni aplica automáticamente la migración histórica.

Guardar pestañas requiere selección humana. La captura reutiliza la extracción DOM del navegador integrado, limita cada texto a 50 KB y la API vuelve a sanear URLs. No se guardan cookies, credenciales, formularios ni screenshots.

## Reuniones y HITL

Meeting Ops conserva su revisión y aprobación. `MeetingSyncService` usa Project Hub cuando `MEETING_PROJECT_SYNC_V2` no es `false`: agrupa las acciones aprobadas por proyecto, crea una evidencia de reunión y crea o vincula tareas en una transacción idempotente. Sin aprobación, proyecto objetivo único o sesión autorizada no escribe.

## Datos y despliegue

- IRIS: `apps/database/migrations/024_project_hub_api_v1.sql` en el repositorio Project Hub.
- Lia: `database/lia/migrations/project-hub-federation.sql`.
- Contrato: `docs/openapi/project-hub-v1.yaml` en Project Hub.
- OpenSpec y verificación: `openspec/changes/integrate-project-hub-api/`.

Ninguna migración se aplica automáticamente. El orden es respaldo y revisión, migración IRIS, migración Lia, despliegue API y activación gradual de `PROJECT_HUB_API_V1`, `PROJECT_HUB_UNIFIED_UI`, `MEETING_PROJECT_SYNC_V2` y `BROWSER_COLLECTIONS`. El rollback operativo desactiva flags y conserva las migraciones aditivas; el outbox permite reanudar entregas.

La función Lia `project-hub-outbox` exige `PROJECT_HUB_OUTBOX_HMAC_SECRET`. Project Hub firma cada evento con `LIA_PROJECT_HUB_OUTBOX_HMAC_SECRET` y lo envía a `LIA_PROJECT_HUB_OUTBOX_URL`; ambos secretos deben contener el mismo valor. El worker de Project Hub se protege además con `PROJECT_HUB_OUTBOX_WORKER_KEY`. El consumidor solo usa `service_role`, no acepta JWT de renderer y rechaza firmas con más de cinco minutos.

## Gestión de tareas, archivos, hitos y equipos

La implementación reutiliza fuente, iconos, Sidebar y controles del Hub. Cada mutación recorre servicio main, handler con caller vigente y confirmación nativa, preload con allowlist y wrapper tipado. Los formularios y detalles se abren dentro del proyecto.

- Tareas: creación, edición, archivo lógico, estado, prioridad global (`task_priorities.level`), responsable activo del proyecto/espacio, vencimiento, estimaciones, ciclo del equipo, subtareas sin ciclos y etiquetas del equipo. El detalle incluye comentarios de texto, documentos e historial. La transacción vuelve a comprobar referencias y revisión.
- Archivos: se conserva la transferencia nativa verificada. Las etiquetas/resúmenes comparan título y resumen originales antes de editar; retirar evidencia archiva su referencia. `pm_project_documents` y `task_issue_documents` se gestionan por separado. Desvincular elimina únicamente la asociación autorizada, nunca el objeto del proveedor. Se sanea la URL y no se infiere su ACL desde el rol del proyecto.
- Hitos: `pm_milestones` usa nombre, descripción, fecha objetivo, estado, fecha completada y orden. Cancelar conserva la fila. El orden no es un porcentaje y no existe una relación tarea-hito en el esquema actual.
- Equipos: `pm_projects.team_id` es el equipo principal. Su pertenencia no concede automáticamente acceso al proyecto. El roster privado exige acceso propio al equipo; sus administradores y los del workspace administran integrantes. El propietario queda protegido. Crear un equipo es atómico con propietario y estados iniciales. Cambiar el equipo de un proyecto con tareas requiere una migración específica y se rechaza con conflicto.
- Listas: tareas, evidencia, hitos y documentos usan cursores y Cargar más. Los filtros forman parte de la clave de carga; una respuesta de otro proyecto/filtro no repone datos antiguos. Consultas agregadas y catálogos recorren páginas internas. Una escritura incierta no se reintenta automáticamente.

La migración aditiva es [20261023-project-management.sql](../../database/iris/migrations/20261023-project-management.sql), con [rollback](../../database/iris/migrations/20261023-project-management.rollback.sql). Sus funciones son `SECURITY INVOKER`, solo ejecutables por `service_role`; la API autentica y autoriza antes de invocarlas. No añade políticas públicas ni cambia el RLS heredado. La inspección detectó RLS deshabilitado en tablas heredadas de tareas/hitos: esta API aplica aislamiento, pero no certifica acceso directo seguro por otros clientes.

Estado: código local y validación aislada. No se aplicó SQL remoto ni se publicó Project Hub. Activación: respaldo/revisión, migración IRIS, despliegue coordinado de rutas v1 y escritorio, y E2E con actores autorizados. La portabilidad, OAuth directo y pertenencia durable de chats conservan su alcance en OpenSpec. Evidencia y límites en el [reporte de gestión](../../openspec/changes/add-portable-project-workspaces/reports/project-management-implementation.md).
