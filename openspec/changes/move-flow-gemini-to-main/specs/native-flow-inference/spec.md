## ADDED Requirements

### Requirement: Inferencia Flow nativa
Electron SHALL ejecutar análisis, fallback y transcripción en main con credencial nativa.
#### Scenario: Solicitud válida
- **WHEN** un cliente confiable pide una operación Flow permitida
- **THEN** main valida entrada, sesión y límites y devuelve sólo texto acotado
#### Scenario: Revocación o datos inválidos
- **WHEN** cambia la sesión o el payload excede los límites
- **THEN** se deniega o descarta el resultado sin exponer la credencial
#### Scenario: Navegador autónomo
- **WHEN** la aplicación funciona fuera de Electron
- **THEN** el flujo anterior permanece disponible
