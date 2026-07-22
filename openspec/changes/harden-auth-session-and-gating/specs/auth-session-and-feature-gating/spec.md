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

#### Scenario: Usuario sin membresía activa

- **WHEN** el perfil se resuelve correctamente pero el usuario no tiene membresía
  activa
- **THEN** el sistema cierra la sesión y solicita autenticación

#### Scenario: Restauración exitosa

- **WHEN** existe una sesión persistida válida y el contexto resuelve
- **THEN** el usuario continúa autenticado sin volver a iniciar sesión

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
