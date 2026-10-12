## ADDED Requirements

### Requirement: Integración trazable de ramas

La integración SHALL conservar la historia de las ramas existentes y mantener
los contratos y protecciones de la implementación vigente.

#### Scenario: Rama histórica defectuosa

- **WHEN** una rama antigua contiene código sustituido o inseguro
- **THEN** sus commits se conservan y la decisión queda documentada sin reactivar
  implementaciones defectuosas

#### Scenario: Notas de versión para usuarios

- **WHEN** se prepara la versión 0.9.9
- **THEN** package y lock coinciden y el changelog explica las mejoras reales
  en español, distinguiendo las funciones locales pendientes de integración
