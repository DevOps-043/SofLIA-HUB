## ADDED Requirements
### Requirement: Colaboración autorizada y persistente
El sistema MUST derivar actor y rol en servidor, persistir comandos idempotentes y recuperar estado por Realtime.
#### Scenario: Participante restringido
- **WHEN** un participante con chat restringido envía un mensaje
- **THEN** Learning deniega la escritura y no publica un éxito local
#### Scenario: Reconexión
- **WHEN** Realtime se reconecta tras perder eventos
- **THEN** Hub recupera el snapshot autorizado y descarta respuestas obsoletas
#### Scenario: Integración aún no publicada
- **WHEN** Learning responde `401 UNAUTHENTICATED` desde su filtro web o la ruta studio está ausente (404/405)
- **THEN** Hub informa que el estudio aún no está habilitado, sin atribuir el fallo a permisos académicos del usuario
#### Scenario: Sesión vencida
- **WHEN** Learning responde 401 desde el handler bearer sin el marcador del filtro web
- **THEN** Hub solicita iniciar sesión nuevamente y conserva un mensaje distinto del rechazo académico 403
#### Scenario: Sesión eliminada
- **WHEN** el handler responde 404 «Sesión no encontrada» después de un acceso válido
- **THEN** Hub revoca el aula y descarta el grant previo, sin confundirlo con una ruta no publicada

### Requirement: Preparación de Engine
El sistema MUST validar un manifiesto versionado de contenido de curso y mantener el acceso académico.
#### Scenario: Material de otro curso
- **WHEN** se importa un manifiesto cuyo curso no coincide con la sesión
- **THEN** el servidor rechaza la importación sin modificar el contenido

### Requirement: Medios y reunión reales
El sistema MUST distinguir captura local de conexión Zoom y liberar recursos al salir.
#### Scenario: SDK sin configurar
- **WHEN** faltan credenciales SDK en Learning
- **THEN** el panel informa que la conexión audiovisual requiere configuración
  administrativa en Learning, sin nombrar al proveedor ni afirmar transmitir
#### Scenario: Rol del SDK
- **WHEN** un participante solicita ingreso
- **THEN** la firma usa rol participante aunque el cliente intente solicitar permisos de anfitrión
#### Scenario: Revocación del grant anterior
- **WHEN** un snapshot autorizado cambia el rol o deja de autorizar al usuario
- **THEN** Hub desmonta la reunión y descarta el grant anterior antes de mostrar otra vista

### Requirement: Presentación de la sesión en Hub
Hub MUST usar etiquetas de sesión sin nombres de proveedor en sus controles,
ayudas y errores audiovisuales propios. MUST conservar ingreso explícito y
sincronización autorizada, sin mostrar la conexión técnica Realtime en el panel.
Los controles oficiales dentro del runtime externo conservan su implementación.

#### Scenario: Instructor o participante abre el estudio
- **WHEN** Learning confirma el acceso al aula
- **THEN** se ofrece Conectar sesión o Unirme a la sesión según el rol, sin badge
  Realtime ni textos propios de Hub que nombren al proveedor
