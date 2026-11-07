## Context

Estado: diseño propuesto, no implementado. Fecha: 2026-10-23. Alcance y evidencia en [context-pack.md](context-pack.md) y motivación en [proposal.md](proposal.md).

El usuario confirmó ambas modalidades de nube —cliente de escritorio y conexión directa— y colaboración sobre proyecto, tareas y archivos. La API local del servidor ya maneja negocio y miembros, pero no demuestra aprovisionamiento transaccional, identidad portable o permisos de archivos externos. No se asume que el contrato local esté desplegado.

## Goals / Non-Goals

**Goals:**
- Identidad estable aunque cambien nombre, ruta, cuenta de almacenamiento o dispositivo.
- Archivo principal donde lo elige el usuario; registro de negocio compartido en el servidor.
- Separación entre archivo portable, permisos de negocio, permisos del proveedor y preferencias privadas del equipo.
- Creación/importación/traslado que pueda recuperarse después de un fallo parcial sin borrar datos ajenos.
- Colaboración comprobable entre dos usuarios y dos equipos, incluida revocación.
- Apartado de proyecto como destino de navegación en la superficie principal; resumen, recursos y ejecución con menú vertical, sin pestañas ni nuevas ventanas.

**Non-Goals:**
- Convertir las carpetas Lia actuales en carpetas físicas ni moverlas automáticamente.
- Proveer otro OneDrive/Drive general, CRDT de documentos Office, Git obligatorio, shell runtime o sincronización de todo el disco.
- Compartir archivos locales por una ruta remota del PC del propietario.
- Aplicar código, migraciones, invitaciones o despliegues en esta entrega de planificación.

## Decisions

### D01. Tres identidades separadas

1. **Proyecto lógico:** `portable_id` UUID generado por Soflia, independiente del nombre; `project_id` y `workspace_id` del servidor una vez registrado. Un archivo con un UUID no acredita acceso.
2. **Ubicación compartida:** proveedor, cuenta/drive/contenedor y ID estable de carpeta, visibilidad y estado de acceso. El nombre o URL visible es descriptivo, no una clave ni un secreto.
3. **Vínculo de dispositivo:** el mismo proyecto puede abrirse en una ruta distinta en cada equipo. `binding_id`, dueño, dispositivo, raíz absoluta, cuenta local conectada y estado se guardan en un índice privado de main. La ruta absoluta no se publica en el proyecto, exportación, logs ni eventos colaborativos.

Un vínculo local no concede membership. Un único proyecto puede tener varias copias de trabajo autorizadas y una raíz compartida activa por árbol; copias adicionales se declaran como réplicas, no como nuevos proyectos implícitos.

Alternativa descartada: almacenar `C:\Users\...` como identidad global del proyecto. No funciona entre dispositivos, filtra información y confunde copia con duplicación.

### D02. Autoridad explícita de datos

| Información | Autoridad | Copia portable/local |
|---|---|---|
| Nombre, tareas, estados, comentarios, membresías y permisos | API de proyectos/IRIS con actor verificado | Instantánea versionada, nunca permiso ejecutable |
| Bytes de archivos | Ubicación elegida o raíz compartida declarada | Inventario, hashes y versiones |
| Ubicación física del equipo | Índice privado del usuario/dispositivo | Excluida de manifiesto y exportación |
| Tokens, claves y sesiones | Custodia cifrada por usuario/cuenta | Nunca dentro del proyecto |
| Chats/carpetas/minutas Lia | Su dominio existente | Referencias autorizadas; contenido sólo si se selecciona y puede exportarse |
| Estados de operación y pendientes | Diario durable del coordinador y registro idempotente del servidor | Fuera de la carpeta sincronizada |

Los permisos del servidor no se editan modificando un JSON. Una instantánea de tareas sirve para portabilidad/offline y se reconcilia contra revisión del servidor; no crea dos fuentes de verdad.

### D03. Modos de almacenamiento

| Modo | Elección de ubicación | Dueño de sincronizar bytes | Condición de colaboración |
|---|---|---|---|
| Local | Selector nativo de carpeta | Sin sincronización remota implícita | Los archivos son privados hasta publicarlos explícitamente |
| OneDrive/Drive de escritorio | Carpeta montada/sincronizada elegida | Cliente del proveedor | Todos necesitan acceso del proveedor y vincular su copia |
| Google Drive directo | Selector autenticado de cuenta/carpeta | Adaptador Soflia de Drive | Cada colaborador usa su cuenta y permiso sobre la raíz |
| OneDrive directo | Selector autenticado de drive/carpeta | Adaptador Soflia de Graph | Igual, con validación personal/empresa según soporte |

En modo directo, el proveedor es la ubicación primaria y la copia/cache local es opcional y se elige o se identifica como cache administrada. No se anuncia una carpeta del escritorio si sólo existe una cache interna. En modo local/sincronizado, los archivos se crean realmente bajo la raíz aprobada antes de dar por concluida la creación.

Ambas modalidades se incluyen, pero no se activan dos motores para el mismo árbol. Registrar `sync_owner` por vínculo; al convertir modo se pausa el anterior, se comprueban versiones y se solicita aprobación. Cuando no se puede establecer si dos selecciones apuntan al mismo árbol, no se promete detección automática perfecta: se exige elegir otra raíz o resolver la correspondencia antes de activar sincronización directa.

La detección de OneDrive/Drive es una ayuda, nunca una obligación de rutas fijas. Windows permite redirigir Escritorio y los proveedores pueden estar en otra unidad. Los archivos sólo en línea requieren hidratación con progreso y cancelación; no se confunden con symlinks ordinarios. Si el filesystem/proveedor no cumple los controles de lectura/escritura, se informa y no se degrada a una operación insegura.

### D04. Experiencia de creación y apertura

Flujo: Nuevo proyecto → nombre/organización/equipo → dónde guardar → carpeta padre y subcarpeta nueva → qué compartir → colaboradores → revisión → crear.

- Local: crear una subcarpeta nueva de forma exclusiva. Si existe contenido, ofrecer abrir proyecto, adoptar carpeta con vista previa o elegir otro nombre; nunca formatear/sobrescribir.
- Cloud directo: mostrar cuenta, drive y breadcrumb, comprobar permisos y crear la subcarpeta aprobada. Cancelar no crea proyecto.
- La revisión diferencia ubicación privada, raíz compartida y archivos que se van a subir. Invitar no publica todo el árbol por defecto.
- Guardar preferencias por usuario/dispositivo para la siguiente creación; confirmar siempre la ubicación efectiva.
- Al abrir en otro equipo, verificar identidad y pedir la carpeta local o cuenta del proveedor. No escanear el disco completo para buscar el proyecto.
- Una raíz movida desde el explorador pasa a «Carpeta no encontrada»; «Volver a localizar» comprueba el manifiesto y acceso antes de actualizar el vínculo.
- Trasladar físicamente un proyecto es una operación separada: copia verificada, cambio del vínculo/raíz y conservación del origen hasta una eliminación explícita. Desvincular del equipo, archivar proyecto y borrar archivos son acciones distintas.

### D05. Aprovisionamiento con recuperación, no transacción ficticia

Filesystem, API y proveedor no comparten una transacción. Usar una operación durable con `operation_id`, actor, `portable_id`, destino aprobado, revisión, recibos y pasos terminados. Nunca guardar rutas privadas en el recibo compartido.

Secuencia propuesta:
1. Validar sesión, nombre, cuenta, capacidad y destino; aprobar el resumen.
2. Registrar intención local y crear únicamente la subcarpeta/metadata propia. Para cloud directo registrar intención antes del primer efecto y la carpeta resultante al recibir su ID.
3. Escribir manifiesto inicial de forma recuperable y atómica cuando el proveedor lo soporte. Usar staging exclusivo para filesystem; no exigir hard links a todos los filesystems.
4. Registrar proyecto, propietario, enlace compartido y recibo en una transacción del servidor, con clave idempotente y unicidad sobre identidad portable/organización.
5. Finalizar manifiesto con el binding del servidor, registrar inventario y mostrar éxito verificable.

Estados visibles: preparando, carpeta creada, pendiente de registro, activo, pendiente de sincronizar, conflicto, requiere reconectar, ubicación ausente, recuperación requerida y cancelado. No equivalen a éxito.

Si se pierde la respuesta del paso 4, consultar el recibo antes de reintentar. Si el servidor confirmó y falla escribir el manifiesto, conservar proyecto y carpeta y ofrecer reparar. Si el usuario modifica la carpeta creada, no borrarla como compensación. Tras reiniciar se reconstruye el siguiente paso desde el diario; una operación cancelada no se transforma en rollback supuesto.

Sin red se permite preparar/abrir una copia de trabajo y conservar cambios locales; el proyecto queda «Pendiente de registro». No se anuncian invitaciones ni colaboración activas hasta validar el servidor. La cola nunca escribe después de revocar sesión o perder permisos.

### D06. Manifiesto y paquete portable

Formato propuesto `.soflia/project.json` dentro del proyecto. JSON legible y validado, acompañado por un inventario versionado y snapshots bajo `.soflia/exports/` sólo cuando se generan. No se copia una base operativa local completa a la nube.

| Campo propuesto | Función |
|---|---|
| `format`, `schema_version`, `min_reader_version` | Compatibilidad y migraciones explícitas |
| `portable_id`, `name`, `created_at` | Identidad y descripción |
| `origin` | Procedencia y binding de servidor opcional; sólo orientativo hasta reautorizar |
| `snapshot_revision`, `exported_at` | Revisión lógica coherente y fecha de captura |
| `files` | ID lógico, ruta relativa, tamaño, MIME, SHA-256 y revisión base |
| `included_data` | Qué snapshots/archivos se incluyeron y qué referencias son sólo enlaces |
| `provenance`, `parent_export_id` | Historial de copia/restauración, sin otorgar ownership |
| `extensions` | Espacio versionado y acotado para evolución, sin ejecutar contenido |

El inventario puede segmentarse para no cargar miles de entradas en el renderer. La versión/hash detecta corrupción, no autenticidad ni permisos; un atacante puede recalcular hashes. No se confía en manifestos como instrucciones para agentes.

Nunca incluir tokens, cookies, .env, claves, rutas absolutas, IDs de dispositivo, conexiones OAuth, ACL ejecutables ni diarios privados. Proponer exclusiones editables de .git, node_modules, caches y enlaces externos. Revisión positiva de archivos exportados y política de sensibilidad prevalecen sobre un simple listado de extensiones. Un secreto copiado a un nombre inocuo sigue siendo información sensible: no se promete detección infalible.

Paquete propuesto `nombre.soflia-project.zip`: manifiesto, snapshots JSON de negocio accesible, archivos seleccionados y sumas. No es un ZIP con extensiones arbitrarias declarado seguro. Los enlaces Drive/OneDrive y documentos nativos se incluyen como referencias o exportaciones con formato elegido; no se finge que son archivos binarios idénticos editables fuera del proveedor. La política puede exigir cifrado: si no hay un formato cifrado compatible habilitado, bloquear esa exportación en lugar de improvisar criptografía.

### D07. Exportar e importar son operaciones de dominio

Exportar: verificar permisos y revisión → seleccionar contenido → estimar tamaño y exclusiones → producir instantánea coherente → escribir staging → verificar → publicar paquete. Volver a comprobar acceso antes de publicar. Si cambia un archivo durante la lectura, reintentar acotadamente o mostrar exclusión/conflicto; no entregar un respaldo aparentemente completo con bytes de revisiones mezcladas.

Modos de importación:
- **Abrir/vincular el proyecto existente:** mismo `portable_id` y servidor/origen reconocido; reautenticar y comprobar membership actual. Cada equipo guarda su propio vínculo.
- **Crear una copia independiente:** nuevos IDs de proyecto/tareas/archivos; conservar procedencia y remapear referencias. Miembros/roles del paquete no se activan y asignaciones no resolubles quedan sin asignar con aviso.
- **Restaurar sobre uno existente:** owner/admin y permiso de restaurar, revisión esperada, comparación, respaldo previo y confirmación. Sólo combinar entidades con una regla definida; un ZIP no justifica reemplazar tablas.

Si no se puede validar el origen o falta acceso, ofrecer copia independiente, sin certificar pertenencia o revivir un proyecto revocado. Importar dos veces con la misma operación no duplica proyecto; dos copias deliberadas reciben identidades distintas.

Validar antes de publicar: esquema soportado, límites, inventario/rutas, hashes y compatibilidad de destino. Rechazar path traversal, rutas absolutas/UNC, ADS de NTFS, enlaces fuera de raíz, dispositivos, nombres reservados, duplicados por mayúsculas/Unicode, archivos comprimidos maliciosos y relaciones de snapshots inconsistentes. Extraer en staging limitado y volver a validar al publicar; no ejecutar scripts ni abrir automáticamente archivos importados.

### D08. Colaboración y doble autorización

Permiso efectivo = permiso del proyecto ∩ capacidad otorgada sobre los archivos ∩ sesión/cuenta vigente ∩ política de la organización. La carpeta compartida no da acceso al proyecto y la membresía no abre el disco de otro usuario.

Esta intersección gobierna operaciones a través de Soflia. El acceso directo desde el proveedor sigue sus propias ACL y no puede depender de consultar la membresía Soflia. El manifiesto cotidiano compartido contiene sólo la información mínima aprobada; no lleva snapshots de tareas, comentarios o miembros. Esos snapshots sólo se generan como parte de una exportación con destino y audiencia revisados. Revocar en Soflia no protege bytes que siguen accesibles por un grant externo conservado.

| Rol de proyecto | Tareas/documentos de negocio | Miembros/configuración | Archivos |
|---|---|---|---|
| Owner | Administración completa | Transferencia, miembros, almacenamiento y políticas | Según permiso real del proveedor |
| Admin | Gestión y revisión | Miembros/configuración; raíz si se le concede gestión de almacenamiento | Según proveedor |
| Member | Crear/editar trabajo permitido | Sin elevar roles ni cambiar raíz compartida | Leer/escribir sólo lo autorizado |
| Viewer/Guest | Lectura de lo concedido | Sin administración | Lectura si proveedor/política lo permiten |

Exportar/restaurar masivamente tiene permiso propio: por defecto owner/admin; member sólo si la política lo concede. No se eleva a owner por introducir un UUID o email. Transferencia de propiedad es una operación explícita, no otro addMember.

Invitación por usuario o correo: pendiente → aceptada/rechazada/expirada/revocada. La aceptación se liga a la identidad autenticada y a la organización/proyecto previsto; el token se almacena con hash, vence y no se registra en logs. La invitación no envía archivos antes de aceptarse y comprobar permisos. Invitados externos sólo si la política de la organización los habilita, con acceso acotado al proyecto; no se les incorpora como miembros generales del workspace por compartir un archivo. La API actual sólo admite miembros existentes del workspace: el flujo de invitación/guest es una extensión necesaria del servidor.

Para archivos puramente locales hay dos opciones explícitas: vincular una raíz de Drive/OneDrive ya compartida, o publicar copias aprobadas de archivos seleccionados al almacenamiento privado del Hub. Esta segunda opción reutiliza el protocolo de subida privado existente y requiere sus límites/permisos; no mueve originales ni publica el escritorio. Sin una de estas vías, la UI debe indicar que la colaboración de archivos no está configurada.

Permisos del proveedor: conservar grants preexistentes, registrar sólo los grants creados por Soflia, no crear enlaces públicos y no ampliar una carpeta padre. No usar el token del propietario para hacerse pasar por un colaborador. Si el proveedor no permite gestionar permisos, guiar al usuario y verificar el acceso real sin marcar «Compartido» por anticipado.

Revocar: denegar nuevas peticiones inmediatamente en el servidor, detener colas/descargas del cliente al reconectar, cerrar concesiones propias del proveedor y marcar pendientes no revocables automáticamente. Revocar Soflia no elimina permisos externos preexistentes ni borra copias ya descargadas; no hay borrado remoto silencioso del disco del colaborador.

### D09. Proveedores y resolución de conflictos

Un puerto pequeño de almacenamiento implementado en main comparte selección/verificación, listar/leer/escribir, crear carpeta, versiones, inventario y capacidades. Soporte de compartir, subida reanudable o precondición se anuncia por proveedor; no se inventa una interfaz que todos tengan que fingir soportar. Los conectores de calendarios no se convierten en un servicio universal de tokens de almacenamiento.

Google Drive directo: preferir selección explícita y scope drive.file; validar en un spike permisos de carpetas existentes, hijos y unidades compartidas. El Picker nativo redirige al navegador del sistema según la documentación actual. Pedir permisos adicionales sólo si una capacidad comprobada lo exige y se explica. Consumir feed de cambios con cursor; pérdida de cursor exige reconciliación conservadora, nunca propagar borrados a ciegas.

OneDrive directo: Graph v1.0, cuenta y driveItem estables, reanudación y control de conflictos por eTag/If-Match donde la operación los admita; cambios incrementales con deltaLink y tratamiento de cursor expirado. AppFolder sólo cubre la carpeta especial de la app, no satisface por sí solo «elige cualquier carpeta». Validar scopes/picker/tenant para cuentas personales y de trabajo/escuela antes de fijar permisos mínimos; no solicitar acceso a todo el tenant por comodidad.

En cualquier proveedor, un cambio del mismo archivo desde dos equipos conserva ambas versiones y pide resolver; no aplicar last-write-wins silencioso. Para Google y filesystem sincronizado no asumir compare-and-swap universal: comprobar capacidades, almacenar revisiones/bytes inmutables antes de publicar referencias y serializar operaciones de Soflia. Las modificaciones externas siguen siendo posibles; no se promete bloqueo global. El caché y los watchers no autorizan sobrescritura.

Estado de tareas/negocio: revisiones del servidor, conflicto 409/412 de contrato propuesto y cola idempotente. Archivos: hash, versión base, copia en conflicto y resolución explícita. Evitar enviar notificaciones/polling duplicados por cada vista; un coordinador por cuenta/proyecto con cancelación, backoff y límites.

### D10. Contratos propuestos y datos

Los siguientes son conceptos a validar, no tablas existentes ni IPC ya registrado:

- Servidor: identidad portable única, operaciones idempotentes de aprovisionamiento/importación, raíces compartidas de almacenamiento, inventario/versiones de archivos, invitaciones y auditoría. Reutilizar pm_projects, task_issues y pm_project_members donde el contrato verificado lo permita.
- Índice local: vínculos de usuario/dispositivo a raíz privada, cuenta cifrada, cursores, último estado y operaciones pendientes. Sin rutas absolutas en metadata genérica remota.
- API de dominio a especificar: preparar/finalizar/consultar aprovisionamiento, registrar raíz compartida, listar inventario y revisiones, preparar/finalizar exportación/importación, aceptar/revocar invitación y consultar capacidad de archivo. Names/rutas definitivos se aprueban en el contrato, antes de codificar.
- IPC de dominio a definir en las cuatro capas: seleccionar destino, crear/abrir/vincular proyecto, inspeccionar/exportar/importar paquete, mover copia de trabajo, gestionar colaboradores y observar/cancelar operación. Renderer usa IDs opacos de selección/operación; no recibe shell, tokens, bytes completos ni una primitiva arbitraria de rutas.

Cambio de sesión, cuenta, organización, frame o revisión invalida una aprobación pendiente. Una confirmación de creación puede cubrir los pasos exactamente descritos por esa operación; no hace falta pedir por cada llamada técnica. Retirar archivos o conceder acceso adicional fuera del resumen requiere una nueva revisión.

Cada operación expone correlation_id, progreso, contadores/recibos, error seguro, cancelación, uncertain y recoveryRequired donde corresponda. Un timeout después de una escritura no se traduce en «no ocurrió nada».

### D11. Presupuestos y comprobaciones de capacidad

Presupuestos iniciales propuestos para validar con muestras: manifiesto hasta 1 MiB, hasta 10.000 entradas, 1 GiB total descomprimido, profundidad 32 y streaming limitado; tamaños concretos por archivo y ratio de expansión se fijan en el spike y se publican en UI antes de importar. No son garantías existentes. La subida privada actual de la API limita a 20 MiB por archivo y diez intenciones por lote; no usar ese protocolo para anunciar arbitrariamente archivos de 1 GiB. Direct cloud y paquetes pueden tener otros límites comprobados; el límite efectivo depende del destino y aparece antes de copiar.

Almacenamiento sin espacio, placeholders, red lenta, cierre de aplicación, nombre largo y volúmenes con características distintas forman parte del contrato de pruebas. El staging/diario vive en límites explícitos y no conserva archivos sensibles indefinidamente sin política de limpieza visible.

### D12. Espacio de proyecto dentro de la interfaz principal

Requisito explícito del usuario: al abrir un proyecto se muestra una pantalla distinta del chat en la misma interfaz, sin pestañas ni ventanas nuevas. Se mantiene la estructura global de Soflia y se sustituye el contenido central por el proyecto. No se reutiliza el envío de un prompt al chat ni la barra de tabs del UnifiedProjectHub heredado como mecanismo de apertura.

**Estructura de navegación propuesta:**

- Entrada global Proyectos → lista/búsqueda de proyectos autorizados → abrir proyecto → Resumen.
- Barra lateral existente con grupo contextual del proyecto: Resumen, Tareas, Archivos, Páginas web, Chats vinculados, Hitos, Ciclos, Equipos, Métricas y Actividad. Configuración sólo para quien tenga capacidad. No crear una segunda barra global o pestañas horizontales.
- Dentro del proyecto, la envolvente lateral existente cambia a contexto de proyecto: regreso Todos los proyectos, identidad del proyecto, Nuevo chat, icono Navegador, búsqueda local al proyecto, apartados y chats recientes autorizados. No duplicar el menú global dentro de otra barra. Chats vinculados se etiqueta Chats del proyecto en navegación e incluye tanto chats nuevos propios como referencias explícitas de origen externo.
- Un único destino activo, identificado por proyecto/sección/recurso. Encabezado persistente con breadcrumb, nombre, estado, responsable, fechas y acciones autorizadas. Las rutas son estado interno tipado; no contratos IPC inventados.
- Seleccionar un apartado o un recurso sustituye el área central; no abre pestaña, ventana, popup ni modal de trabajo. Los formularios se presentan en esa superficie. Una confirmación breve puede ser inline.
- Volver conserva sección, filtros, selección y scroll por proyecto. Al alternar al chat global se conserva el borrador anterior sin enviarlo ni convertirlo en chat del proyecto. Abrir de nuevo un proyecto entra a Resumen; Volver restaura el contexto desde el que se navegó.
- Chats vinculados → conversación contextual en la misma superficie, con breadcrumb de regreso. Se reutiliza el motor de chat y su custodia, no se duplica el dominio. El dashboard de entrada no tiene compositor ni se convierte en una conversación.
- En pantallas estrechas el menú vertical se contrae y se expande en el flujo de la misma interfaz. Navegación por teclado, foco visible, encabezados semánticos, contraste según tokens y preferencia de movimiento reducido.

**Resumen de entrada:** encabezado con descripción/objetivo, responsable, estado y fechas; indicadores esenciales; próximos hitos; tareas prioritarias; ciclo activo si existe; equipos/colaboradores; accesos a archivos, webs y chats recientes; actividad reciente. El detalle completo se abre desde el menú o el bloque correspondiente. No cargar todos los dominios al entrar ni convertir el resumen en una pared de tablas.

| Apartado | Contenido y comportamiento propuesto |
|---|---|
| Información general | Objetivo, alcance, responsable, estado, prioridad, fechas, ubicación y estado real de acceso/sincronización |
| Tareas | Lista inicial con estado, responsable, vencimiento, prioridad, hito y ciclo opcionales; filtros y detalle con revisión de servidor |
| Archivos | Inventario paginado de la raíz elegida y archivos publicados; origen, acceso, disponibilidad, versión/conflicto y vista previa segura |
| Páginas web | Referencias/colecciones explícitas con título, URL, autor de asociación y fecha; contenido capturado sólo con permiso y procedencia |
| Chats del proyecto | Conversaciones creadas en el contexto o vinculadas explícitamente, última actividad y visibilidad; abrir/crear/desvincular sin mover carpetas Lia |
| Hitos | Objetivo, fecha, estado, responsable y tareas asociadas; distinguir avance calculado de estado declarado; tareas sin hito siguen siendo válidas |
| Ciclos | Cadencia opcional, periodo, capacidad/unidad si se configura, tareas comprometidas y estado; no crear sprints por defecto ni deducirlos de fechas |
| Equipos | Equipos asignados, responsables y colaboradores efectivos; distinguir equipo de origen de autorización individual del proyecto |
| Métricas | Avance, bloqueos, cumplimiento de fechas/hitos y desempeño por ciclo cuando exista historial suficiente; filtros, definición y frescura |
| Actividad | Cambios y decisiones autorizados con actor/fecha; paginación y redacción de datos sensibles |

**Métricas propuestas, no cifras existentes:** avance de tareas = completadas/no canceladas del alcance filtrado; denominador cero → Sin tareas, no 0 % ni 100 %. Bloqueadas exige un estado/bandera de bloqueo definido, no se infiere de falta de actividad. Vencidas = pendientes con fecha anterior al día de corte en la zona del proyecto; si no existe zona, mostrar la zona usada como fallback. Hitos completados/total y participantes activos requieren definiciones separadas de invitaciones pendientes. Throughput = tareas completadas en periodo; tiempo de ciclo y burndown sólo con historial de transiciones y cambios de alcance, nunca reconstruidos de una foto actual. No sumar puntos de equipos con escalas distintas. Cada cifra muestra ámbito, periodo, zona, actualización y acceso a su explicación. No hay alertas de riesgo o porcentajes de salud inventados.

**Asociaciones y permisos:** vincular no copia ni comparte. Cada relación proyecto↔chat/web/archivo/equipo conserva origen, identidad, visibilidad y actor; cardinalidad y ownership se fijan en contrato. Un chat privado sólo se puede vincular como referencia privada del usuario autorizado. Mostrarlo al proyecto requiere una operación de publicación separada, previa revisión del contenido y audiencia, y soporte real del dominio de conversaciones; si no existe, se bloquea. No incluir títulos, previews o contadores de recursos privados en listados o métricas de otro actor. Desvincular no borra el origen. Cambiar de equipo asignado no concede membresías masivas: la matriz de acceso del servidor debe resolver y explicar la política efectiva.

**Webs/archivos no confiables:** referencias no transportan cookies ni sesiones del navegador. Sólo URL http/https revisada, sin credenciales o secretos embebidos; no persistir parámetros sensibles por defecto. Previsualización en la misma superficie, saneada y sin scripts/herramientas runtime; validación de red en cualquier fetch para no permitir SSRF o acceso implícito a intranet. Si una web no admite vista previa, mostrar el límite y conservar el enlace; no abrir automáticamente otra pestaña/ventana como fallback. Documentos y páginas no son instrucciones del agente.

**Contratos y carga:** verificar recursos disponibles de hitos/ciclos/equipos/historial y analítica en el servidor, e implementar los faltantes. No deducir soporte por existencia de tablas. Resumen agregado autorizado por actor con semántica común a los detalles; evitar N+1 y un polling por tarjeta. Cargar secciones bajo demanda, listas paginadas y vistas extensas virtualizadas según medición. Al cambiar usuario/organización/proyecto se cancelan o descartan respuestas antiguas, se invalida caché y no se conserva una preview de otro actor. Identificar carga, vacío, no configurado, no disponible por capacidad, permiso denegado, error/reintento y última copia offline; un error no se convierte en cero.

**Diseño visual:** usar los tokens existentes de src/index.css y sus temas. La propuesta clara usa fondo #f9fafb, lateral #f0f2f5, tarjetas blancas y texto/acción navy #0a2540; el modo oscuro hereda los tokens existentes con acento #00d4b3. Newsreader puede usarse en títulos e Inter Tight/IBM Plex Sans en interfaz/etiquetas. Bordes discretos, densidad moderada y jerarquía de contenido; sin paleta paralela. El mockup es una imagen conceptual con datos de ejemplo, no evidencia de una UI implementada ni de resultados reales.

### D13. Lateral flotante compartido y contexto durable de conversación

Actualización de implementación: el usuario pidió conservar la tipografía e
iconografía de la aplicación y botones más redondeados. Los títulos usan
`--font-system-ui`, no la familia serif del mockup; Button/Card y la envolvente
Sidebar se reutilizan. En posición global bottom se conserva la preferencia,
pero el proyecto presenta navegación vertical para evitar tabs o menús nuevos.
El adaptador de chats sólo consume vínculos/carpetas existentes y autorizados;
no satisface todavía el nuevo registro portable de conversaciones del plan.
La comprobación remota de metadatos en SofLIA HUB no encontró la tabla heredada
`project_chat_bindings`: se declara la dependencia y se bloquea creación sin
vínculo, sin desplegar SQL como efecto colateral de este panel.

La revisión del usuario conserva el panel central de la primera imagen y cambia sólo su lateral. Fuentes canónicas: [estándar de interfaz](../../../docs/standards/design-system.md), [sistema visual](../../../docs/ux/design-system.md), [arquitectura frontend](../../../docs/architecture/frontend.md) y componentes versionados [Sidebar](../../../src/components/Sidebar.tsx), [cabecera](../../../src/components/sidebar/SidebarHeader.tsx), [acciones](../../../src/components/sidebar/SidebarTopActions.tsx) y [acceso de herramientas](../../../src/components/sidebar/SidebarNavTools.tsx). Reutilizar composición y primitives; no copiar otra implementación completa de sidebar ni crear un tema de proyecto.

**Geometría observada que se replica:** wrapper en layout con espacio reservado y margen interior exterior de 10 px; superficie interior rounded-2xl (16 px con la escala actual), borde fino, blanco al 80 %, blur y sombra navy suave en claro. Oscuro conserva superficie profunda translúcida y sombra del Sidebar. Ancho inicial observado 276 px, límites 220–520 y colapso a 78 px exteriores; reutilizar el controlador de tamaño y PanelResizeGrip, completando teclado/foco en lugar de propagar carencias. Flotante significa separado visualmente del canvas dentro de la ventana; no crea BrowserWindow ni overlay que tape el contenido principal. Preferencias de usuario se conservan y se acotan al actor; el mockup muestra posición izquierda. Si se usa derecha/bottom, adaptar la composición existente con las mismas acciones y acceso a secciones/chats sin convertir el proyecto en pestañas.

**Composición de arriba abajo:**

1. Marca compacta y control de colapsar, con el tratamiento real de SidebarHeader.
2. Todos los proyectos y bloque de identidad del proyecto activo.
3. Acción Nuevo chat y botón icon-only de globo para Abrir navegador del proyecto, con aria-label, tooltip y estado activo/degradado. Búsqueda de este proyecto, no de todos los chats del usuario.
4. Menú de apartados con filas compactas, radio interior rounded-xl, selección semántica y foco visible.
5. Grupo Chats del proyecto con recientes/fijados autorizados, opción Ver todos y desplazamiento interno. No competir con la navegación: las secciones y el pie permanecen accesibles cuando la lista crece; a baja altura se contrae el grupo, sin recortar controles.
6. Pie de identidad/organización y configuración según permiso, reutilizando UserMenu. No listar conversaciones globales ni otras carpetas en el contexto del proyecto.

**Todos los chats creados aquí pertenecen al proyecto:** Nuevo chat, atajos, crear desde una tarea/recurso y nuevo chat desde el navegador reciben un contexto inmutable de usuario/organización/proyecto capturado al iniciar. El alta persiste conversación y asociación como una única operación de dominio idempotente, con recibo y recuperación entre dominios si no comparten transacción. No marcar como completado ni guardar en el chat general cuando falla la asociación. Offline conserva conversación y project_id como pendientes, sin perder origen al reconectar. Al cambiar de proyecto una respuesta tardía no reasigna ni mueve la conversación al proyecto ahora visible. No mover carpetas Lia existentes: la asociación portable es independiente de folder_id.

Crear dentro del proyecto establece pertenencia, no visibilidad pública: la UI muestra si es privado o compartido y respeta la política del proyecto; no eleva permisos ni expone conversaciones previas. El chat general sigue fuera hasta una vinculación explícita. Las listas, búsqueda, borradores, selección, caché y contadores se aíslan por actor/organización/proyecto y se reautorizan al recuperar sesión. Desvincular o trasladar un chat propio del proyecto es una acción explícita y revisada; navegar, cerrar el panel o salir de Soflia no lo desvincula. Referencias externas conservan sus reglas de publicación.

**Navegador del proyecto:** el globo abre/reutiliza el navegador integrado en la misma superficie principal, mantiene identidad del proyecto y permite volver al resumen. No crea una ventana o pestaña por entrar al apartado ni usa tabs para navegar secciones del proyecto. Guardar una página como recurso es explícito; navegar no publica historial, cookies o todas las webs visitadas. El navegador y sus acciones de chat usan el contexto capturado; la sesión de sitios web conserva el aislamiento existente por usuario/cuenta y no se comparte por asociar el proyecto. Se mantiene el límite entre navegación web autenticada del motor existente y previews saneadas del panel.

Componer sobre [BrowserWorkspaceLayout](../../../src/components/browser/BrowserWorkspaceLayout.tsx) y los servicios existentes. La WebContentsView nativa puede tapar DOM aunque éste tenga z-index alto: reservar y recalcular bounds/insets del navegador para lateral, cabecera y paneles, incluyendo resize/colapso y vista estrecha; no resolver con una segunda ventana o capturas simuladas. En este contexto el selector de conversaciones y Nuevo chat del navegador sólo operan sobre el proyecto activo. Volver restaura sección/filtros; al cambiar de actor/proyecto se invalida el contexto de acciones pendientes sin filtrar datos anteriores.

## Risks / Trade-offs

- [Base divergente y cambios ajenos] → fijar una base reconciliada, con revisión humana de las eliminaciones frente a los hardenings; no cherry-pick destructivo a ciegas.
- [RLS/permisos heredados inseguros] → validar estado efectivo y transición del servidor antes de habilitar colaboración; no resolver con service-role en renderer.
- [Proyecto creado sin propietario o ubicación] → transacción del servidor y estado de operación verificable; el POST actual por sí solo no es suficiente.
- [Permiso Soflia distinto del proveedor] → mostrar por separado, denegar cuando falta cualquiera y no certificar revocación externa sin recibo.
- [Sincronizadores externos y pérdida de bytes] → un motor Soflia por árbol, revisiones y copias en conflicto; no promesa de bloqueo contra terceros.
- [Paquete adulterado] → validación por lista positiva, staging seguro, reautorización y ninguna ejecución automática.
- [Copias locales tras revocar] → declarar el límite; revocar futuro acceso, no prometer recuperar información ya exportada.
- [Más complejidad por cuatro modos] → puertos pequeños, suites de conformidad por proveedor y entregas secuenciales; no abstraer calendarios/credenciales/DOM en una clase monolítica.
- [Filtrado de chats privados o contadores agregados] → autorización por recurso y actor en servidor; referencias privadas separadas y publicación explícita.
- [Métricas aparentes sin historial o módulos vacíos tratados como cero] → fórmulas y ámbitos comunes, estados honestos y recopilación de historial antes de gráficos históricos.

## Migration Plan

1. Acordar y congelar base de código; conservar el commit de retirada como evidencia e integrar selectivamente contratos/guardas útiles. No mover carpetas existentes.
2. Verificar API/identidades/RLS y diseñar migraciones aditivas para IRIS/estado local con backups, orden, pruebas entre actores y rollback. Esta propuesta no las aplica.
3. Introducir creación portable bajo bandera separada; mantener el flujo Lia existente accesible sin conversión automática ni doble creación del outbox.
4. Entregar ubicación local y cliente de escritorio con diario/registro, incluida la estructura del apartado de proyecto. Después portabilidad, colaboración, Drive directo y OneDrive directo; completar recursos, hitos/ciclos/equipos y métricas del panel con contratos verificados y las mismas invariantes.
5. Probar importación desde carpetas actuales sólo como acción voluntaria y con copia previa; no hacer backfill ni inferir permisos por nombre de carpeta.
6. Habilitar por cohortes tras criterios de aceptación. Retirar fachadas heredadas sólo con inventario de consumidores cero y fecha documentada.

Rollback: desactivar la creación portable/colas del proveedor afectado, conservar proyectos/archivos/operaciones pendientes y volver a la versión compatible con su manifiesto. No ejecutar down destructivo, borrar directorios ni reabrir permisos RLS para recuperar servicio.

## Comprobaciones pendientes antes de implementar

Las decisiones de producto están fijadas para este plan. Quedan pruebas técnicas de alcance: API realmente desplegada, estado de permisos, scopes/pickers por cuenta, soporte real de escritura condicionada y límites de carga. Una variante de proveedor que no pase su suite no se declara soportada: vuelve al spike o al modo de carpeta sincronizada, sin perder del alcance final la conexión directa solicitada.

## Fuentes oficiales consultadas

Consulta: 2026-10-23. Estas fuentes sustentan capacidades del proveedor, no que Soflia ya las implemente.

- [Scopes Drive y drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
- [Picker para aplicaciones de escritorio](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).
- [Feed de cambios Drive](https://developers.google.com/workspace/drive/api/guides/manage-changes).
- [Upload sessions e If-Match de Graph v1.0](https://learn.microsoft.com/en-us/graph/api/driveitem-createuploadsession?view=graph-rest-1.0).
- [Delta de Graph v1.0](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0).
- [Límites de AppFolder](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder).

## Decisión de implementación: gestión funcional del panel

La solicitud posterior concreta tareas, archivos, hitos y equipos sobre el panel existente. La inspección de IRIS confirma hitos, documentos de proyecto/tarea, comentarios/historial/etiquetas y `pm_projects.team_id`. No se inventa una asociación de múltiples equipos ni tarea-hito. La prioridad de tareas usa `level` y el estado completado usa `done`.

Se incorporan rutas v1 y operaciones IPC de dominio acotadas al proyecto. Una escritura incierta exige recarga antes de repetir. Las tareas y la inicialización de equipo usan transacciones exclusivas del servidor. Las actualizaciones comparan revisiones o, para evidencia sin `updated_at`, título y resumen originales. La asignación de equipo bloquea el proyecto y rechaza cambiarlo cuando ya tiene tareas. La modificación de tareas bloquea el mismo proyecto y equipo para ordenar numeración y jerarquías.

Se respeta el esquema existente. El aislamiento de clientes directos sobre tablas con RLS heredado deshabilitado requiere revisión independiente antes de certificar colaboración en producción. La migración remota y el despliegue permanecen pendientes de autorización explícita y validación con actores reales.
