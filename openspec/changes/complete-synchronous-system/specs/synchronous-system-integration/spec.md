## Purpose

Integrar preparación, participación y medios del aula síncrona conservando permisos, compatibilidad y resultados comprobables entre productos.

## ADDED Requirements

### Requirement: Participación autorizada y compatible
Learning MUST validar reacciones y cadencia de mensajes de forma transaccional y conservar respuestas compatibles para clientes anteriores.

#### Scenario: Cadencia e idempotencia
- **WHEN** un participante repite un comando confirmado o envía otro antes de la espera
- **THEN** el duplicado conserva el resultado y el segundo comando distinto recibe 429 sin otra publicación.

#### Scenario: Consumidor anterior
- **WHEN** un cliente no negocia participación
- **THEN** recibe el formato anterior sin ledger, eventos ni intervalos adicionales.

### Requirement: Preparación por curso
La entrega de Engine MUST utilizar contenido aprobado vigente y conservar identidad de curso, sesión, revisión y audiencia sin exponer respuestas privadas.

#### Scenario: Curso o revisión incompatible
- **WHEN** se intenta entregar una preparación ajena o desactualizada
- **THEN** se rechaza sin sobrescribir el estudio.

### Requirement: Salas audiovisuales verificables
La sincronización MUST utilizar identidades firmadas y permisos reales del proveedor, y comunicar fallos sin declarar un traslado académico como traslado audiovisual.

#### Scenario: Identidad no correlacionable
- **WHEN** falta correspondencia de un participante con el proveedor
- **THEN** el panel comunica el pendiente y no asigna por nombre visible.

### Requirement: Evidencia de activación
La entrega MUST distinguir pruebas locales de configuración, migración, grabación y llamada reales.

#### Scenario: Cuenta no preparada
- **WHEN** no existe configuración o permiso audiovisual
- **THEN** se informa el requisito y no se anuncia una transmisión o grabación exitosa.

#### Scenario: Instalador para pruebas
- **WHEN** se entrega el paquete Windows del candidato
- **THEN** el ASAR excluye AGENTS.md y SKILL.md, incluso en dependencias, y se registra versión y hash del artefacto sin atribuirle un despliegue web.

#### Scenario: Configuración efectiva del instalador
- **WHEN** falta una URL o clave pública de autenticación, se recibe una clave elevada o el bundle carece del origen de Learning QA
- **THEN** la compuerta detiene la distribución y reporta la variable o comprobación que falló, sin revelar su valor.
