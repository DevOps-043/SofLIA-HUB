## ADDED Requirements

### Requirement: Mención de SofLIA en el chat de la sesión

El aula SHALL permitir que un participante o instructor mencione a SofLIA y que Learning publique la respuesta en el hilo de la pregunta, con la misma visibilidad que el mensaje original.

#### Scenario: Mención desde una sala

- **WHEN** una persona autorizada envía una pregunta con @SofLIA en una sala
- **THEN** quienes pueden leer esa pregunta ven una respuesta atribuida a SofLIA debajo de ella
- **AND** Learning publica como máximo una respuesta por pregunta aunque se repita la solicitud

#### Scenario: Denegación o fallo

- **WHEN** falta consentimiento, se revoca el acceso, la sala cambia o falla la inferencia
- **THEN** no se publica contenido de SofLIA
- **AND** quien preguntó recibe un aviso y puede reintentar si se recupera la capacidad

### Requirement: Contexto académico autorizado

Learning SHALL construir cada turno con el estado actual de la sesión y las fuentes académicas autorizadas, con las mismas garantías para consultas públicas y privadas.

#### Scenario: Consulta acerca de material o actividades

- **WHEN** SofLIA recibe una pregunta sobre la presentación publicada, un archivo compatible, una práctica o el quiz activo
- **THEN** puede usar ese contenido para explicar, orientar o citar su origen
- **AND** identifica información ausente y protege las claves de evaluación, los borradores y las salas ajenas

#### Scenario: Fuentes conversacionales

- **WHEN** el chat contiene aportaciones recientes de otras personas con consentimiento vigente
- **THEN** SofLIA puede usar esas aportaciones dentro del alcance de su sala
- **AND** el contenido se excluye cuando falta o se revoca el consentimiento
