## ADDED Requirements

### Requirement: Documentos completos y publicación por audiencia
El sistema SHALL generar los documentos de apoyo faltantes desde el plan y fuentes aprobadas, validar su integridad y permitir al instructor publicar únicamente las secciones destinadas al participante.

#### Scenario: Nueva generación de materiales
- **WHEN** termina una nueva generación de materiales de sesión
- **THEN** contiene instrumentos de evaluación, contingencias, plantilla de registro y aplicabilidad de los tres entregables condicionales

#### Scenario: Documento reservado
- **WHEN** un participante consulta la sesión con documentos publicados
- **THEN** recibe solo las secciones públicas publicadas y carece de respuestas esperadas y notas del facilitador

#### Scenario: Cambio de entradas
- **WHEN** cambian el plan o las fuentes que respaldan los documentos
- **THEN** la aprobación queda obsoleta y la entrega exige actualizar los materiales

#### Scenario: Cliente de primera entrega
- **WHEN** el cliente negocia preparación pero omite la cabecera de documentos
- **THEN** recibe bloques y notas con la forma anterior y sin campos de documentos

### Requirement: Preparación de sesión autorizada
El sistema SHALL conservar el plan por bloques y las notas de una revisión aprobada de Architect y entregar la preparación privada únicamente al instructor autorizado.

#### Scenario: Conducción en Hub
- **WHEN** el instructor abre una sesión con preparación recibida
- **THEN** Hub muestra la revisión, bloques en orden, duración y notas disponibles

#### Scenario: Participante consulta snapshot
- **WHEN** un participante autorizado consulta el estudio
- **THEN** Academy excluye toda la preparación privada y conserva sus recursos públicos

### Requirement: Compatibilidad y consistencia
El sistema SHALL admitir manifiestos anteriores y negociar campos de respuesta nuevos.

#### Scenario: Cliente anterior
- **WHEN** el cliente omite la cabecera de preparación
- **THEN** la respuesta conserva la forma anterior aunque el estado almacenado incluya preparación

#### Scenario: Plan incompatible
- **WHEN** el plan repite identificadores, sus duraciones son inconsistentes o refiere recursos ajenos
- **THEN** la entrega es rechazada antes de aplicar contenido parcial
