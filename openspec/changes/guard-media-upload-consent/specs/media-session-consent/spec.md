## ADDED Requirements

### Requirement: Consentimiento vigente de medios
El cliente SHALL comprobar la sesión y la misma aprobación antes de transferir medios.
#### Scenario: Revocación durante consulta de clave
- **WHEN** cambia sesión o consentimiento antes de enviar
- **THEN** la operación no transfiere el archivo ni toma una aprobación posterior
#### Scenario: Respuesta anterior
- **WHEN** la subida responde después de revocación
- **THEN** no publica ese resultado ni afirma que el proveedor revirtió el efecto
