## ADDED Requirements

### Requirement: Presentación compacta
La agenda MUST presentar datos reales con jerarquía mínima, temas claro/oscuro y adaptación al ancho del contenedor.

#### Scenario: Consultar próximas sesiones
- **WHEN** un usuario abre la agenda
- **THEN** ve sus próximas sesiones asignadas con fecha, instructor, duración y entrada explícita al aula, sin controles de gestión no autorizados.

### Requirement: Capacidades y aislamiento
El panel MUST habilitar gestión e historial exclusivamente con el permiso confirmado por Learning y MUST reiniciar selección al cambiar organización.

#### Scenario: Acceso de gestor
- **WHEN** Learning confirma administración o docencia en la organización activa
- **THEN** se ofrece su catálogo autorizado, historial y acceso al panel de gestión existente, sin conceder permisos por una etiqueta de rol.

#### Scenario: Historial manipulado por alumno
- **WHEN** un alumno solicita period past o intenta vista instructor
- **THEN** el servidor deniega antes de consultar datos protegidos.

#### Scenario: Respuesta antigua
- **WHEN** cambia organización, página o vista y llega una respuesta anterior
- **THEN** esa respuesta no reemplaza ni revela la agenda activa.

### Requirement: Períodos coherentes
El catálogo MUST excluir programaciones vencidas de upcoming antes de contar y paginar, preservando su historial sin mutaciones y manteniendo las que Learning aún marca en vivo.

#### Scenario: Programación vencida sin cierre
- **WHEN** una sesión aún programada ha superado inicio más duración
- **THEN** no ocupa la agenda próxima y puede consultarse en historial autorizado como registro sin cierre.

### Requirement: Compatibilidad
El endpoint MUST negociar capacidades y mantener el cuerpo v1 anterior para clientes que no las solicitan.

#### Scenario: Cliente anterior
- **WHEN** no se recibe la cabecera de capacidades
- **THEN** la respuesta conserva sus campos anteriores sin ampliar permisos ni incluir enlaces privados.
