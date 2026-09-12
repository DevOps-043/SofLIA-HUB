## ADDED Requirements

### Requirement: Persistencia de sesión resistente a fallos transitorios

El sistema SHALL conservar la sesión persistida entre reinicios y MUST NOT cerrar
la sesión ante un fallo recuperable al resolver el contexto del usuario; solo una
denegación real (sin membresía activa o credenciales inválidas) cierra la sesión.

#### Scenario: Reinicio con SOFIA momentáneamente indisponible

- **WHEN** la app restaura la sesión y la resolución de contexto falla por un
  error de red o timeout
- **THEN** la sesión se mantiene, el sistema marca estado degradado y reintenta,
  sin borrar la sesión persistida

#### Scenario: El directorio caído no arrastra a las conversaciones

- **WHEN** la resolución del contexto SOFIA (organizaciones y equipos) falla pero
  la sesión sigue siendo verificable
- **THEN** el sistema degrada únicamente el selector de organización y establece
  igualmente la sesión de conversaciones, que no depende de ese directorio

#### Scenario: Reintento automático del directorio

- **WHEN** el contexto SOFIA quedó degradado por un fallo recuperable
- **THEN** el sistema lo reintenta solo, con espera creciente y también al
  recuperar red o foco, y lo restaura sin reiniciar la app en cuanto responde

#### Scenario: Sesión restaurada sin token verificable

- **WHEN** la sesión se restaura desde el snapshot local porque el proveedor de
  autenticación ya no tiene una sesión válida
- **THEN** el sistema no promete un reintento automático: informa que la sesión
  caducó y pide volver a iniciar sesión, sin cerrarla por su cuenta

#### Scenario: Usuario sin membresía activa

- **WHEN** el perfil se resuelve correctamente pero el usuario no tiene membresía
  activa
- **THEN** el sistema cierra la sesión y solicita autenticación

#### Scenario: Restauración exitosa

- **WHEN** existe una sesión persistida válida y el contexto resuelve
- **THEN** el usuario continúa autenticado sin volver a iniciar sesión

### Requirement: El escritorio no depende de leer el directorio de usuarios

El cliente de escritorio MUST NOT requerir permiso de lectura sobre la tabla de
usuarios de SOFIA. La clave anónima viaja dentro del ejecutable, así que ese
permiso equivaldría a publicar el directorio completo. El acceso SHALL limitarse
a funciones acotadas que devuelvan el mínimo necesario.

#### Scenario: Traducción de identificador antes de autenticar

- **WHEN** el usuario inicia sesión con su nombre de usuario en vez de su correo
- **THEN** el sistema obtiene únicamente el correo con el que autenticar, sin
  leer ningún otro dato de esa cuenta ni de ninguna otra

#### Scenario: Perfil propio ya autenticado

- **WHEN** la sesión está establecida y se resuelve el perfil
- **THEN** el sistema obtiene solo la fila del usuario autenticado, y no puede
  obtener la de otro aunque conozca su identificador

#### Scenario: Identificador inexistente

- **WHEN** el identificador no corresponde a ninguna cuenta
- **THEN** el mensaje es el mismo que ante credenciales inválidas, sin revelar
  si la cuenta existe

### Requirement: Estado de autenticación conocido por el proceso main

El proceso main SHALL mantener un estado de autenticación provisto por el renderer
mediante un canal IPC gobernado, con valor inicial "no autenticado", y MUST NOT
transportar tokens ni datos personales más allá del identificador de usuario.

#### Scenario: Publicación de estado

- **WHEN** el renderer inicia sesión, la cierra o la restaura
- **THEN** publica el estado por el canal y el main actualiza su store

#### Scenario: Estado inicial en el arranque

- **WHEN** el main aún no recibe el estado del renderer
- **THEN** asume "no autenticado" y niega las funciones sensibles

#### Scenario: Payload inválido

- **WHEN** llega un payload que no cumple el contrato del canal
- **THEN** el handler lo rechaza sin alterar el estado

### Requirement: Negación por defecto de funciones sensibles

El sistema MUST negar la creación o el uso de la orbe, la autoconexión y acciones
de WhatsApp, y los handlers con efectos de computer-use y desktop-agent cuando no
exista sesión válida, devolviendo un resultado tipado sin ejecutar efectos.

#### Scenario: Orbe por wake word sin sesión

- **WHEN** se detecta la wake word, el atajo global o el menú del tray sin sesión
  válida
- **THEN** la orbe no se crea ni se muestra y el sistema indica que se requiere
  autenticación

#### Scenario: Acción de WhatsApp sin sesión

- **WHEN** se intenta autoconectar o ejecutar una acción de WhatsApp sin sesión
- **THEN** la operación se rechaza con `auth_required` y sin efectos

#### Scenario: Handler con efectos sin sesión

- **WHEN** un handler de computer-use o desktop-agent que produce efectos se
  invoca sin sesión
- **THEN** el guard lo rechaza antes de ejecutar el efecto

### Requirement: Revocación de acceso al cerrar sesión

El sistema SHALL revocar el acceso a las funciones sensibles cuando el estado pasa
a "no autenticado", cerrando u ocultando la orbe y deteniendo superficies activas.

#### Scenario: Logout con orbe abierta

- **WHEN** el estado cambia a "no autenticado" con la orbe visible
- **THEN** la orbe se cierra u oculta y no responde a wake word ni atajo hasta una
  nueva sesión válida

#### Scenario: Logout con WhatsApp activo

- **WHEN** el estado cambia a "no autenticado"
- **THEN** el sistema detiene la autoconexión y no ejecuta nuevas acciones hasta
  reautenticar
