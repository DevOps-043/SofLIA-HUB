## Purpose

Proteger las APIs heredadas de WhatsApp y Telegram y sus eventos al integrarlas
con la autoridad y aprobación nativas de Soflia Hub sin romper el flujo del panel.

## ADDED Requirements

### Requirement: Administración derivada en main
El sistema SHALL verificar fuente, sesión, organización y rol en las quince rutas heredadas.
#### Scenario: Actor o fuente falsos
- **WHEN** un cliente falso aporta otro actor o no proviene de Hub/Orbe
- **THEN** se rechaza sin efectos, sin fallback a administración permisiva
#### Scenario: Aprobación revocada
- **WHEN** cambia sesión, organización o rol mientras se espera aprobación
- **THEN** no se produce un nuevo efecto o publicación en la sesión posterior

### Requirement: Gateway y publicación acotados
El sistema SHALL compartir cuota/aprobación y publicar eventos sólo a receptores autorizados.
#### Scenario: Evento de WhatsApp
- **WHEN** hay viewers válidos y llega QR/estado
- **THEN** se revalida el rol y contexto antes de enviar, sin duplicación ni cola ilimitada

### Requirement: UI fiel al resultado
El renderer SHALL conservar su estado confirmado y respetar rechazo/error/cancelación.
#### Scenario: Abrir o cancelar
- **WHEN** se abre el panel o se cancela una mutación
- **THEN** no se guarda una clave por abrir ni se representa éxito de la mutación cancelada
#### Scenario: Operación obsoleta
- **WHEN** se cierra o cambia el actor mientras espera un resultado
- **THEN** el resultado anterior no actualiza la nueva vista
