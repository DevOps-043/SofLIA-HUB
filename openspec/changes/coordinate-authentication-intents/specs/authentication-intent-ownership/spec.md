## Purpose

Conservar una intención de acceso o cierre vigente dentro del proveedor de autenticación y evitar que operaciones superadas recuperen identidad o contexto anteriores.

## ADDED Requirements

### Requirement: Prevalencia de intención

El proveedor MUST invalidar operaciones anteriores antes de esperar al iniciar otro acceso, cancelarlo o cerrar sesión. Una respuesta, error o finally obsoleto MUST conservar el estado de la intención nueva, incluso A/B/A.

#### Scenario: Cierre durante acceso
- **WHEN** se solicita cerrar mientras el acceso espera al SDK
- **THEN** revoca estado local inmediatamente y la respuesta del acceso no restaura usuario, contexto o conversaciones

#### Scenario: Accesos fuera de orden
- **WHEN** comienza otro acceso mientras el anterior sigue pendiente
- **THEN** sólo el vigente puede publicar y sus mutaciones SDK locales esperan el final físico de la anterior

### Requirement: Integración de eventos y recuperaciones

Eventos Auth, restauración, directorio y conversaciones MUST compartir vigencia del proveedor. Los eventos ordinarios emitidos por el acceso propio MUST permitir su éxito, sin aceptar una identidad SDK observada incompatible con su resultado.

#### Scenario: Evento propio
- **WHEN** el SDK emite SIGNED_IN durante un acceso vigente
- **THEN** no cancela ese acceso por su propio evento y conserva validación de membresía y correo

#### Scenario: Contexto tardío
- **WHEN** termina un reintento del directorio después del cierre o cambio de cuenta
- **THEN** no publica contexto ajeno ni borra el error de otra sesión

### Requirement: Cancelación SSO durante todas sus etapas

La solicitud federada MUST conservar ownership después de reclamar el retorno. Cancelación, otro acceso o desmontaje MUST impedir abrir navegador o comenzar canje/OTP/persistencia posteriores todavía no iniciados.

#### Scenario: Creación tardía de solicitud
- **WHEN** se cancela mientras se calcula la solicitud federada
- **THEN** no abre el navegador al terminar ni rehabilita la solicitud

#### Scenario: Canje tardío
- **WHEN** se cancela después de recibir el retorno y mientras espera canje
- **THEN** no completa perfil, recupera Lia ni modifica estado de otra solicitud

### Requirement: Revocación y límites

El cierre o cambio intencional MUST revocar la publicación existente a main sin esperar lectura de tokens o SDK, conservando su contrato y excluyendo al renderer orbe como publicador. La implementación MUST distinguir descarte de continuaciones de reversión de I/O enviado y mantener autorización del servidor.

#### Scenario: Lectura de token bloqueada
- **WHEN** se cierra con una lectura de sesión pendiente
- **THEN** la publicación de no autenticado no espera esa lectura y la publicación antigua no la sustituye

#### Scenario: I/O en curso
- **WHEN** ya se envió una llamada SDK antes de invalidar
- **THEN** espera su fin para empezar otra mutación local, sin afirmar reversión remota ni aislamiento entre procesos
