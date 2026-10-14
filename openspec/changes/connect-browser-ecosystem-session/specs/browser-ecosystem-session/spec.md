## ADDED Requirements

### Requirement: RF-ECO-001 Acceso automático inicial
Soflia Hub SHALL conectar la cuenta SOFIA vigente al visitar Learning, Engine o
Project Hub en su navegador integrado y SHALL conservar las cookies en la
partición del usuario.

#### Scenario: Primera visita autenticada
- WHEN el usuario abre un origen permitido sin una sesión ni conexión previa
- THEN main canjea el bearer antes de navegar y el sitio establece su sesión

#### Scenario: Identidad no disponible o sitio no publicado
- WHEN no existe identidad SOFIA vigente o falla el canje
- THEN la web puede continuar con su inicio de sesión habitual

### Requirement: RF-ECO-003 Conservación de la elección de cuenta
Soflia Hub SHALL conservar sesiones existentes y cierres de sesión, y SHALL
permitir reconectar explícitamente con su cuenta.

#### Scenario: Otra cuenta o cierre de sesión
- WHEN el usuario eligió una cuenta en la web o cerró sesión
- THEN nuevas pestañas, reinicios y expiraciones de cookies no la reemplazan automáticamente

#### Scenario: Reconexión elegida
- WHEN el usuario selecciona «Usar mi cuenta de Soflia Hub» en un sitio permitido
- THEN el sitio reemplaza su sesión y la pestaña se recarga

### Requirement: RNF-ECO-001 Frontera de identidad
Soflia Hub SHALL restringir el canje a orígenes exactos autorizados, y SHALL
rechazar redirecciones, perfiles invitados/privados y cambios de identidad.
Los sitios SHALL validar Auth, perfil y membresías, y SHALL responder sin
credenciales del escritorio.

#### Scenario: Destino o emisor no autorizado
- WHEN un destino no permitido o un frame secundario solicita conexión
- THEN no recibe identidad ni puede elegir credenciales o destinos por IPC

#### Scenario: Cuenta o documento cambia
- WHEN cambia la cuenta, el perfil o el documento durante el canje
- THEN la operación no confirma ni persiste una conexión exitosa

#### Scenario: Usuario o membresía deshabilitados
- WHEN Auth rechaza el bearer o no hay perfil y membresía autorizados
- THEN el sitio no emite una nueva sesión para el usuario
