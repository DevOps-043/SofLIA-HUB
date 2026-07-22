## ADDED Requirements

### Requirement: Modelo por defecto estable

El sistema SHALL mantener `gemini-3.5-flash` como modelo por defecto cuando la
solicitud no especifica uno, aunque existan modelos más nuevos en el catálogo.

#### Scenario: Solicitud sin modelo

- **WHEN** una solicitud de chat no indica modelo
- **THEN** el sistema usa `gemini-3.5-flash`

### Requirement: Catálogo con los modelos nuevos

El catálogo seleccionable MUST incluir `gemini-3.5-flash-lite` y
`gemini-3.6-flash` como opciones válidas, y `gemini-3.6-flash` MUST NOT ser el
default.

#### Scenario: Selección de un modelo nuevo

- **WHEN** el usuario elige `gemini-3.6-flash` o `gemini-3.5-flash-lite`
- **THEN** las solicitudes usan el modelo elegido sin afectar el default de otras
  sesiones

#### Scenario: Identificadores válidos

- **WHEN** el sistema resuelve un ID del catálogo para llamar a la API
- **THEN** el ID corresponde a un modelo declarado en la configuración central,
  sin cadenas inventadas
