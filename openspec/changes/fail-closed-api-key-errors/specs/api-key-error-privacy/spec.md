## ADDED Requirements

### Requirement: Credenciales fallan de forma segura
El cliente SHALL distinguir ausencia de clave y fallo de lectura sin exponer detalles.
#### Scenario: RPC falla
- **WHEN** RPC falla o devuelve un tipo inesperado
- **THEN** la operación se rechaza sin presentar el error privado ni activar fallback
#### Scenario: Operación de credenciales falla
- **WHEN** guardar o borrar devuelve error
- **THEN** el resultado y los logs no revelan el detalle privado
#### Scenario: Validación de clave
- **WHEN** se valida una clave Google
- **THEN** se envía en cabecera y no en la URL
