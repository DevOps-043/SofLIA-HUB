## Purpose

Permitir que cada proyecto mantenga su identidad y referencia de negocio mientras sus archivos residen en una ubicación elegida por el usuario, sin alterar las carpetas de chats existentes.

## ADDED Requirements

### Requirement: Selección explícita de almacenamiento
El sistema SHALL permitir elegir carpeta local, carpeta sincronizada de OneDrive o Google Drive y conexión directa a ambos proveedores. SHALL mostrar cuenta, ubicación efectiva, responsable de sincronización y cambios externos antes de confirmar.

#### Scenario: Crear en una subcarpeta del escritorio
- **WHEN** el usuario selecciona una carpeta padre y confirma un nuevo proyecto
- **THEN** los archivos y metadatos del proyecto se crean en una subcarpeta nueva de ese destino y la referencia de negocio se registra sin mover otras carpetas

#### Scenario: Carpeta ya ocupada o selección cancelada
- **WHEN** el destino contiene archivos o el usuario cancela su selección
- **THEN** no se sobrescribe contenido; se ofrece abrir/adoptar con revisión o elegir otro destino, y cancelar no registra un proyecto activo

### Requirement: Identidad independiente de ruta y dispositivo
El sistema SHALL separar identidad portable, identidad del servidor, ubicación compartida y vínculo local privado. Las rutas absolutas SHALL permanecer privadas por usuario/dispositivo y no conceder permisos.

#### Scenario: Abrir desde otro equipo
- **WHEN** un miembro autorizado abre el mismo proyecto desde una ruta distinta
- **THEN** conserva la identidad y tareas del proyecto y registra sólo el vínculo local de ese usuario/dispositivo

#### Scenario: Carpeta movida externamente
- **WHEN** deja de existir la ruta registrada
- **THEN** muestra ubicación ausente y permite volver a localizarla verificando identidad, sin crear otro proyecto ni escanear el disco completo

### Requirement: Registro idempotente y recuperación durable
El sistema SHALL mantener un estado verificable de aprovisionamiento entre carpeta y servidor, recuperable tras reinicio y acotado al actor. SHALL consultar efectos inciertos antes de repetir una escritura y no borrar archivos del usuario como compensación automática.

#### Scenario: Se pierde la respuesta después del registro
- **WHEN** el servidor registra el proyecto pero el cliente recibe timeout
- **THEN** el reintento consulta o reutiliza el recibo idempotente y no crea otro proyecto o propietario

#### Scenario: Cierre tras crear carpeta
- **WHEN** se cierra Soflia antes de finalizar el registro
- **THEN** al volver permite completar o revisar la operación pendiente y conserva la carpeta y los archivos existentes

#### Scenario: Creación offline
- **WHEN** se prepara una copia de trabajo sin conexión
- **THEN** conserva su identidad y archivos como pendiente de registro, sin anunciar colaboración o invitaciones activas

### Requirement: Preservación y acciones separadas
El sistema SHALL conservar las carpetas y conversaciones anteriores sin migración implícita. Desvincular un equipo, archivar el proyecto, cambiar la raíz y borrar archivos SHALL ser acciones distinguibles con autorización correspondiente.

#### Scenario: Traslado aprobado
- **WHEN** el propietario traslada la copia de trabajo a otra ubicación
- **THEN** se verifica la copia antes de actualizar el vínculo y el origen se conserva hasta una eliminación expresamente aprobada

#### Scenario: Sesión cambia durante la selección
- **WHEN** cambia usuario, organización o cuenta tras aprobar un destino
- **THEN** se invalida esa aprobación y no se continúa con la identidad anterior

### Requirement: Apartado de proyecto en la interfaz principal
El sistema SHALL abrir el proyecto en un apartado propio distinto del chat, sustituyendo el contenido central y conservando la interfaz global. SHALL presentar Resumen como entrada y navegación vertical contextual para Tareas, Archivos, Páginas web, Chats del proyecto, Hitos, Ciclos, Equipos, Métricas y Actividad. SHALL NOT crear pestañas o ventanas nuevas para navegar el proyecto ni enviar un prompt al chat como mecanismo de apertura.

#### Scenario: Abrir desde Proyectos
- **WHEN** el usuario abre un proyecto autorizado desde la lista
- **THEN** aparece su resumen con identidad y contexto correctos en la superficie principal, sin compositor de chat ni pestañas o ventanas nuevas

#### Scenario: Navegar secciones y volver desde un recurso
- **WHEN** el usuario abre un archivo, página o chat vinculado y vuelve al proyecto
- **THEN** navega en la misma superficie mediante menú vertical y breadcrumb, conservando filtros y posición, sin abrir otra pestaña o ventana

#### Scenario: Alternar con el chat global
- **WHEN** el usuario cambia entre el apartado del proyecto y su chat global
- **THEN** conserva el borrador del chat sin enviarlo ni asociarlo automáticamente al proyecto

### Requirement: Información general y ejecución del proyecto
El sistema SHALL presentar objetivo, descripción, estado, responsables, fechas, ubicación y acceso/sincronización. SHALL permitir consultar tareas, recursos vinculados, próximos hitos, equipos asignados, actividad y ciclos opcionales con autorización por recurso. Hitos, ciclos y equipos SHALL usar contratos comprobados y no datos simulados en producción.

#### Scenario: Proyecto sin equipo o ciclo asignado
- **WHEN** no existen equipos o ciclos configurados
- **THEN** indica ese estado y ofrece una acción sólo a quien tenga permiso, sin crear equipos, ciclos o fechas ficticias

#### Scenario: Una sección falla o no tiene permiso
- **WHEN** una sección está vacía, falla, no está disponible o el usuario no tiene acceso
- **THEN** distingue esos estados, conserva las secciones autorizadas y ofrece reintento sólo cuando corresponda, sin representar errores como cero

### Requirement: Métricas trazables y estados de datos
El sistema SHALL mostrar ámbito, periodo, zona horaria, definición y actualización de métricas autorizadas. Resumen y detalle SHALL compartir semántica. Métricas históricas SHALL requerir eventos suficientes; no se infieren de una instantánea actual ni se mezclan escalas incompatibles.

#### Scenario: Proyecto sin tareas
- **WHEN** el denominador del avance de tareas no canceladas es cero
- **THEN** indica Sin tareas en lugar de inventar un porcentaje de avance

#### Scenario: Historial insuficiente o datos offline
- **WHEN** se consulta rendimiento por ciclo sin historial suficiente o sólo existe una copia local antigua
- **THEN** distingue Sin datos de la última copia offline con su fecha y no dibuja una serie histórica ficticia

#### Scenario: Respuesta anterior tras cambiar de proyecto
- **WHEN** llega una respuesta de métricas o recursos después de cambiar actor, organización o proyecto
- **THEN** la descarta y no muestra ni conserva datos privados del contexto anterior

### Requirement: Lateral flotante coherente con Soflia
El sistema SHALL reutilizar el patrón de Sidebar del Hub con margen exterior, bordes redondeados, superficie y sombra del tema, colapso y ajuste de ancho accesible. SHALL reservar espacio en el layout, incluir Nuevo chat, búsqueda de proyecto, icono de navegador, apartados y conversaciones autorizadas del proyecto. Flotante SHALL NOT significar una ventana adicional.

#### Scenario: Redimensionar o colapsar con navegador visible
- **WHEN** se modifica el tamaño o se colapsa el lateral del proyecto con el navegador integrado abierto
- **THEN** sus límites nativos se recalculan, el lateral permanece visible y operable y no se oculta contenido por un solapamiento entre DOM y vista web

#### Scenario: Conversaciones numerosas o ventana de baja altura
- **WHEN** la lista de chats crece o se reduce la altura disponible
- **THEN** se puede desplazar o contraer el grupo y siguen accesibles las acciones, navegación y perfil sin recortar controles

### Requirement: Navegador dentro del contexto del proyecto
El sistema SHALL abrir o reutilizar el navegador integrado desde el icono lateral conservando el contexto de proyecto, las conversaciones autorizadas y el regreso al panel. SHALL NOT crear ventanas o pestañas por entrar a este apartado ni guardar automáticamente las páginas visitadas como recursos compartidos.

#### Scenario: Abrir navegador y crear conversación
- **WHEN** el usuario entra al navegador del proyecto y pulsa Nuevo chat
- **THEN** la conversación se crea dentro de ese proyecto y volver restaura el contexto anterior del panel sin cambiar de proyecto

#### Scenario: Visitar una página sin guardarla
- **WHEN** el usuario navega y después vuelve al proyecto sin asociar la página
- **THEN** no publica su historial, cookies o contenido visitado en los recursos del proyecto
