## ADDED Requirements

### Requirement: Vigencia de sesión de Flow
Flow SHALL rechazar trabajo y resultados cuando cambia la sesión de origen.
#### Scenario: Cambio durante análisis
- **WHEN** cambia la sesión mientras una solicitud está pendiente
- **THEN** no se reintenta ni se inicia fallback con la entrada anterior
#### Scenario: Cambio durante transcripción
- **WHEN** cambia la sesión antes de recibir la transcripción
- **THEN** el resultado anterior no se publica
#### Scenario: Error con sesión vigente
- **WHEN** el proveedor falla y la sesión permanece vigente
- **THEN** se conserva la recuperación existente
