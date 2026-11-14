## ADDED Requirements

### Requirement: Identidad y persistencia de origen
El sistema SHALL mantener una identidad estable por borrador y guardar localmente conversación y mensaje antes de inferencia, aunque la respuesta tenga un placeholder o falle la red.

#### Scenario: Navegar durante el primer turno
- **WHEN** se envía el primer mensaje de A y se abre B antes de terminar el modelo
- **THEN** A sigue en el historial con su mensaje, y ningún mensaje o workspace de A se publica en B

#### Scenario: Render y varios destinos pendientes
- **WHEN** hay guardados de A y B y React vuelve a renderizar antes del debounce
- **THEN** flush guarda ambos snapshots en sus destinos sin sustituirlos por datos vacíos

### Requirement: Aislamiento de Skill y memoria
El sistema SHALL ligar la Skill, workspace y memoria conversacional al origen y descartar activaciones tardías de otro ámbito.

#### Scenario: Borrador seguido de un chat existente
- **WHEN** una presentación se prepara en un borrador y la persona abre «Apoyo emocional»
- **THEN** el destino no adopta esa presentación, aun con consultas lentas, errores o activación pendiente

#### Scenario: Dos conversaciones del mismo propietario
- **WHEN** el chat obtiene recuerdos semánticos para A
- **THEN** no recibe mensajes ni encargos de B; las preferencias durables del propietario mantienen su política existente

### Requirement: Continuidad de la presentación
El sistema SHALL ejecutar la presentación de Skill como trabajo main con recursos inmutables, independiente de la vista del chat, bajo identidad y organización vigentes.

#### Scenario: Presentación A, conversación B y regreso
- **WHEN** el equipo empieza la presentación en A y la persona conversa en B
- **THEN** el equipo continúa en main y publica su deck y resultado comprobado sólo en A

#### Scenario: Rechazo o cancelación
- **WHEN** el workspace pertenece a otro chat, otro trabajo lo usa, se revoca la sesión o se cancela explícitamente
- **THEN** el sistema rechaza o detiene nuevos efectos y no publica respuestas tardías como éxito

### Requirement: Un único controlador de turno
El sistema SHALL aplicar señal y generación tanto a mensajes manuales como externos.

#### Scenario: Prompt externo y navegación
- **WHEN** se navega o se pulsa Stop durante un prompt externo
- **THEN** sus resultados tardíos no pueden ejecutar nuevas herramientas ni sobrescribir un turno posterior

### Requirement: Procedencia del monitor
El monitor SHALL identificar el origen de cada equipo y distinguir preparación de turno de trabajo durable sin transferir su destino al chat visible.

#### Scenario: Equipos de varios chats
- **WHEN** el monitor global muestra un equipo de A mientras se consulta B
- **THEN** identifica A como origen y permite regresar a su conversación sin cambiar la propiedad del equipo
