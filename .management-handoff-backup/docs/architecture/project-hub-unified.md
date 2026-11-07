# Project Hub unificado

Estado: implementación local detrás de configuración; activación y despliegue por entorno no acreditados integralmente. Actualizado: 2026-10-22.

## Límites de dominio

Project Hub/IRIS es la fuente de verdad de proyectos nuevos, tareas, miembros, evidencia compartida y analítica. Lia conserva carpetas de chats, conversaciones, transcripciones completas, minutas y decisiones de aprobación. Solo cruzan hacia IRIS resúmenes aprobados, hashes, referencias y extractos breves.

Las carpetas existentes aparecen como **Carpetas heredadas** y no se migran. Crear desde la sección **Proyectos** usa la API v1 y registra en el outbox la creación idempotente de la carpeta colaborativa Lia.

## Flujo de autenticación

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

La vista formal abre un apartado en la superficie principal con el lateral flotante del Hub. Sus secciones verticales son Resumen, Tareas, Archivos, Páginas web, Chats del proyecto, Hitos, Ciclos, Equipos, Métricas y Actividad; no usa tabs para navegar el proyecto. Los contratos actuales alimentan tareas, evidencia, miembros y analítica. Hitos/ciclos y detalle de equipos declaran capacidad pendiente, sin cifras ficticias. Los estados sin sesión, API caída y reintento son explícitos. Archivos, Drive, enlaces e investigaciones del navegador se anexan como evidencia; las colecciones son versiones inmutables. La composición y tipografía se documentan en [frontend](frontend.md).

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
