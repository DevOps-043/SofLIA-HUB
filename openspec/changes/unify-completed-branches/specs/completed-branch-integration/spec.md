## ADDED Requirements

### Requirement: Integración verificable de ramas terminadas
La integración SHALL incluir el historial de todas las ramas inventariadas salvo
la rama excluida y SHALL registrar las implementaciones históricas sustituidas.

#### Scenario: Retirada sustituida por un panel posterior
- **WHEN** una rama antigua elimina componentes que otra rama posterior reconstruye
- **THEN** se conserva el panel posterior y se documenta la reconciliación del historial

### Requirement: Preservación del trabajo activo
La integración SHALL conservar el checkout y trabajo sin commit de la rama de deuda,
y SHALL avanzar main local sólo mediante fast-forward con referencia de respaldo.

#### Scenario: Checkout principal con refactorización activa
- **WHEN** el checkout principal contiene cambios de deuda técnica sin commit
- **THEN** la integración se realiza en otro worktree sin moverlos ni incorporarlos

#### Scenario: Validación con fallos
- **WHEN** una comprobación falla en el resultado integrado
- **THEN** se registra el fallo real y no se declara que la compuerta pasó
