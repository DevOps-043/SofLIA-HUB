## ADDED Requirements

### Requirement: Retirada de la integración externa
Soflia Hub SHALL dejar de ofrecer o ejecutar la integración de Project Hub/IRIS.

#### Scenario: Superficie retirada
- **WHEN** arranca Soflia Hub
- **THEN** no registra canales project-hub ni herramientas IRIS, ni intercambia tokens con Project Hub

#### Scenario: Reunión revisada localmente
- **WHEN** se analiza o aprueba una minuta
- **THEN** se conserva en Lia sin publicar proyectos, tareas o evidencia externa

### Requirement: Preservación de datos y capacidades independientes
Soflia Hub SHALL conservar carpetas, conversaciones, fuentes y registros existentes.

#### Scenario: Abrir una carpeta
- **WHEN** se selecciona una carpeta existente
- **THEN** se mantiene su vista de chats y fuentes sin consultar Project Hub

#### Scenario: Identidad compartida
- **WHEN** una función independiente consulta SOFIA
- **THEN** conserva su cliente e identidad sin depender de IRIS
