## Purpose
Ofrecer aulas audiovisuales Video SDK integradas con los permisos de Soflia y conservación privada de sus grabaciones, manteniendo acceso a sesiones anteriores.

## ADDED Requirements

### Requirement: Acceso autorizado por sesión
El sistema SHALL firmar accesos Video SDK en el servidor y derivar identidad y rol de la membresía y del aula autorizada.

#### Scenario: Participante sin permisos de gestión
- **WHEN** un alumno autorizado solicita acceso al aula
- **THEN** recibe un token de participante y nunca credenciales API, secretos ni rol de anfitrión solicitado por el cliente

#### Scenario: Aula cerrada o acceso revocado
- **WHEN** el aula está cerrada o el actor pierde autorización
- **THEN** no se emite un nuevo acceso audiovisual

### Requirement: Proveedor persistente y compatibilidad
El sistema SHALL conservar el proveedor de cada aula y permitir configurar Video SDK para nuevas programaciones sin reservar anfitriones Meeting.

#### Scenario: Sesión anterior
- **WHEN** se abre una sesión creada con Meeting SDK
- **THEN** sigue usando su reunión original aunque cambie el proveedor predeterminado

### Requirement: Recursos audiovisuales del aula
El Hub SHALL permitir conectarse, controlar micrófono, cámara y pantalla y liberar todos los recursos al salir o destruir el iframe.

#### Scenario: Salida mientras se comparte
- **WHEN** el usuario abandona el aula durante una captura
- **THEN** la captura se detiene y se informa la desconexión al estudio

### Requirement: Grabación privada y verificada
El sistema SHALL configurar grabación automática compuesta y reconciliar los archivos del proveedor con la sesión autorizada antes de importarlos al almacenamiento privado.

#### Scenario: Grabación ajena
- **WHEN** los metadatos remotos no corresponden al proveedor y aula asociados al trabajo
- **THEN** se rechaza la importación sin publicar archivos

#### Scenario: Configuración incompleta
- **WHEN** faltan las credenciales o la habilitación necesaria para grabación
- **THEN** la programación o conexión falla con un mensaje en español sin crear una sesión de otro proveedor silenciosamente
