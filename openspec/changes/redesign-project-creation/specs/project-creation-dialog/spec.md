## ADDED Requirements

### Requirement: Diálogo interno de creación
La aplicación MUST mostrar Nuevo proyecto en un diálogo modal de la ventana principal, con nombre y ubicación; MUST NOT mostrar un bloque de organización ni selector workspace. La elección local MUST abrir el selector de carpetas nativo del sistema, asociado a la ventana principal.

#### Scenario: Abrir y cancelar
- **WHEN** una persona pulsa Crear proyecto y después cancela
- **THEN** el diálogo se cierra, restaura el foco y no crea proyecto ni carpetas.

### Requirement: Organización exacta
La aplicación MUST resolver el workspace mediante el ID de la organización activa y restringirlo a los workspaces de la sesión; MUST NOT usar nombres, slugs ni el primer workspace como sustituto.

#### Scenario: Organización de Learning sin equipos
- **WHEN** una persona autorizada crea un proyecto en el workspace de su organización y no existen equipos activos
- **THEN** la API permite crearlo con equipo nulo; no exige crear otro workspace o un equipo manualmente y conserva el aislamiento por organización.

#### Scenario: Cambio de organización
- **WHEN** cambia la organización con un diálogo o solicitud pendiente
- **THEN** se retira el formulario anterior y se descartan sus respuestas; la lista carga únicamente el nuevo contexto.

### Requirement: Ubicación privada del proyecto
La creación MUST admitir una carpeta principal nueva y carpetas adicionales vinculadas, o una carpeta de la cuenta Google Drive/OneDrive vinculada; las rutas locales MUST permanecer en el almacenamiento privado del dispositivo. Los archivos nuevos MUST guardarse en esa ubicación sin pasar por Storage de Soflia.

#### Scenario: Seleccionar una ubicación existente
- **WHEN** ya existe la subcarpeta que se pretende crear
- **THEN** la aplicación conserva su contenido y exige otro nombre o ubicación antes de enviar la creación remota.

#### Scenario: Proyecto en nube
- **WHEN** se elige Google Drive o OneDrive
- **THEN** se muestra la cuenta vinculada y se permite elegir una carpeta del proveedor; la creación prepara allí una subcarpeta sin crear una raíz local ni publicar carpetas adicionales.

#### Scenario: Crear una carpeta desde el selector
- **WHEN** una persona introduce un nombre y pulsa Crear carpeta en la ubicación remota seleccionada
- **THEN** se crea bajo ese padre de la cuenta vinculada, se abre su contenido y no se reenvía automáticamente la escritura ante un resultado incierto.

### Requirement: Cuenta y autorización del proveedor
La aplicación MUST vincular la selección a usuario, proveedor y cuenta. OneDrive MUST solicitar autorización de archivos separada del calendario, con PKCE y state. Las credenciales MUST permanecer cifradas en main.

#### Scenario: Proveedor sin sesión
- **WHEN** no hay una cuenta vinculada de Google o Microsoft, o se está comprobando su conexión
- **THEN** su opción permanece deshabilitada; al faltar sesión muestra «Inicia sesión para continuar» y conserva el destino local disponible.

#### Scenario: Cuenta diferente o permiso ausente
- **WHEN** cambia la cuenta, se desconecta o faltan permisos de archivos
- **THEN** se rechaza la selección anterior o se solicita autorización; no se sustituye por otra cuenta ni por almacenamiento de Soflia.

#### Scenario: Cancelar explorador
- **WHEN** una persona cancela el selector nativo
- **THEN** el formulario y la carpeta previa se conservan sin crear proyecto o archivos.

### Requirement: Resultado incierto
La aplicación MUST registrar cada intento antes del primer efecto y MUST NOT reenviar automáticamente una creación remota cuyo resultado no se puede verificar.

#### Scenario: Respuesta perdida
- **WHEN** se pierde la respuesta después del envío
- **THEN** se conservan los efectos locales y se solicita revisar los proyectos antes de repetir; el mismo identificador de operación no vuelve a enviar el POST.

#### Scenario: Rechazo confirmado de un proyecto local
- **WHEN** la API rechaza de forma confirmada una creación y la persona vuelve a enviar la misma configuración
- **THEN** se reutiliza sólo su carpeta preparada con manifiesto intacto; un resultado incierto o un manifiesto modificado impide esta recuperación.
