## Purpose

Proteger las operaciones del calendario con contratos coherentes entre procesos, controles de identidad y aprobación contextual.

## ADDED Requirements

### Requirement: Actor y entrada comprobados
El calendario IPC MUST rechazar llamadas sin sesión, de una ventana ajena, subframe o payload inválido antes de acceder al proveedor.

#### Scenario: Emisor ajeno
- **WHEN** un marco distinto de main/orbe autorizados invoca calendario
- **THEN** recibe error controlado sin lectura ni mutación remota

#### Scenario: Fecha o campo extra
- **WHEN** una mutación contiene fecha inválida, intervalo invertido o campos no declarados
- **THEN** se rechaza antes del diálogo y del proveedor

### Requirement: Aprobación vigente
Las mutaciones externas SHALL requerir una confirmación nativa con operación, calendario y detalles, cancelar por defecto y revalidar contexto.

#### Scenario: Cambio de identidad durante el diálogo
- **WHEN** cambia la sesión, ventana, marco o conexión, vence el plazo o se cancela
- **THEN** la operación no se ejecuta aun si llega una aceptación tardía

#### Scenario: Diálogos concurrentes
- **WHEN** una confirmación está pendiente y llega otra mutación
- **THEN** la segunda se rechaza sin abrir diálogo ni ejecutar efectos

### Requirement: Respuestas y eventos seguros
El puente SHALL entregar DTO tipados con fechas ISO, sin tokens, conexiones internas o errores crudos, y el wrapper SHALL convertir eventos de respuesta en una lista para consumidores.

#### Scenario: Token renovado
- **WHEN** el servicio emite renovación con una conexión interna
- **THEN** sólo se reenvía el proveedor, nunca el token ni el objeto conexión

#### Scenario: Creación desde chat
- **WHEN** el usuario solicita un evento con título e intervalo ISO válidos
- **THEN** el wrapper transmite el contrato esperado y main convierte fechas antes de invocar el servicio confirmado
