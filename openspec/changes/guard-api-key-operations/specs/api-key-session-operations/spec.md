## ADDED Requirements

### Requirement: Operaciones de credenciales vinculadas a sesión
La lectura y modificación SHALL comprobar vigencia de sesión tras cada espera.
#### Scenario: Sesión cambia durante identificación
- **WHEN** cambia la sesión antes de resolver el usuario
- **THEN** la operación no inicia lectura ni modificación en la base
#### Scenario: Resultado posterior a cambio
- **WHEN** cambia la sesión durante una lectura o escritura ya enviada
- **THEN** no publica datos ni confirma éxito y libera la suscripción
