## ADDED Requirements

### Requirement: Vigencia por sesión y proveedor
La lectura SHALL consultar cada proveedor sin reutilizar credenciales de otra consulta.
#### Scenario: Cambio de proveedor
- **WHEN** se solicita una clave de otro proveedor
- **THEN** se consulta la clave correspondiente sin usar resultados anteriores
#### Scenario: Cambio de sesión durante consulta
- **WHEN** cambia la sesión antes de recibir la clave
- **THEN** la consulta anterior no devuelve esa clave y libera su suscripción
#### Scenario: Modificación de credencial
- **WHEN** se inicia o finaliza una modificación local de credenciales
- **THEN** las lecturas anteriores quedan invalidadas
