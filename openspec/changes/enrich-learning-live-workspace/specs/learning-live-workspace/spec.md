## ADDED Requirements

### Requirement: Antesala y acceso explícito
Hub SHALL mostrar reglas, FAQ, conectividad declarada y privacidad antes de abrir Zoom. El usuario SHALL iniciar la apertura multimedia mediante un botón.

#### Scenario: Abrir desde Learning
- **WHEN** llega una referencia académica y hay identidad verificada
- **THEN** Hub muestra la antesala sin abrir automáticamente Zoom

### Requirement: Colaboración autorizada
Learning SHALL verificar organización, membresía, curso e instructor para cada operación. Las escrituras SHALL ser atómicas e idempotentes y rechazar sesiones cerradas.

#### Scenario: Actor sin curso
- **WHEN** un miembro intenta escribir en una sesión sin asignación ni gestión
- **THEN** la API rechaza la operación y no persiste datos

#### Scenario: Voto duplicado
- **WHEN** el mismo participante vota dos veces una pregunta
- **THEN** existe un solo voto y no se duplica telemetría

### Requirement: Gobierno y privacidad
La política SHALL pertenecer a la organización y cambiar solo por administrador. Analítica opcional SHALL exigir consentimiento vigente. La UI SHALL permitir revocación y mostrar retención.

#### Scenario: Cambio de política
- **WHEN** un administrador modifica permisos analíticos
- **THEN** aumenta la versión y el consentimiento anterior deja de autorizar telemetría

### Requirement: Respuestas privadas y Pulse Checks
FAQ SHALL responder privadamente solo coincidencias verificadas. Pulse Checks SHALL guardar una respuesta por persona y mostrar agregados al instructor sin acreditar dominio de skills.

#### Scenario: FAQ conocida
- **WHEN** una pregunta coincide exactamente con una FAQ configurada
- **THEN** solo quien pregunta recibe la respuesta y no se publica en el canal general
