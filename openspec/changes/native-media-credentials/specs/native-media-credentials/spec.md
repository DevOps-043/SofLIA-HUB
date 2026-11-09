## ADDED Requirements

### Requirement: Credencial nativa para medios
Las operaciones de transferencia SHALL resolver credenciales en main sin aceptarlas del renderer.
#### Scenario: Subida autorizada
- **WHEN** la sesión nativa permite la operación
- **THEN** main consulta la clave y comprueba vigencia antes de transferir
#### Scenario: Credencial aportada por renderer
- **WHEN** el payload incluye una clave
- **THEN** se rechaza sin usar el proveedor
