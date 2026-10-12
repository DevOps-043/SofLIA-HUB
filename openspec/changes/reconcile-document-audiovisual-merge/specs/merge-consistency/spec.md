## ADDED Requirements

### Requirement: Consistencia de la fusión
El sistema SHALL conservar documentos corporativos y capacidades audiovisuales
en una combinación libre de conflictos y de divergencias del catálogo.

#### Scenario: Fusión verificada
- **WHEN** se resuelve la fusión solicitada
- **THEN** los contratos de ambas áreas pasan y no quedan marcadores ni entradas sin fusionar

#### Scenario: Configuración local
- **WHEN** el usuario solicita las variables en `.env`
- **THEN** audiovisual usa ejecutables locales verificados y las credenciales existentes se conservan fuera del commit
