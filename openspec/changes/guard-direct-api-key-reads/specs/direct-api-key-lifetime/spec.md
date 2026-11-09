## ADDED Requirements

### Requirement: Lecturas directas sujetas a vigencia
Todas las fachadas SHALL aplicar la misma guarda de sesión y revisión de claves.
#### Scenario: Cambio de sesión durante RPC directo
- **WHEN** cambia la sesión antes de recibir la respuesta
- **THEN** la lectura se rechaza y libera su suscripción
#### Scenario: Cambio de clave durante RPC directo
- **WHEN** una mutación local invalida las lecturas en curso
- **THEN** la lectura anterior se rechaza sin usar fallback
