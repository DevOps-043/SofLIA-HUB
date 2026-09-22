## Purpose

Integrar el proceso local Codex app-server como proveedor acotado del arnés runtime sin heredar capacidades de desarrollo.

## ADDED Requirements

### Requirement: Compatibilidad e aislamiento
El adaptador SHALL validar soporte de herramientas dinámicas y desactivación de entornos antes de procesar contenido, usar un hogar separado y un entorno mínimo.

#### Scenario: Servidor incompatible
- **WHEN** falta una capacidad requerida o no se confirma la ausencia de entornos
- **THEN** se detiene la conexión y se informa incompatibilidad sin enviar contenido de reunión.

### Requirement: Transporte acotado
El adaptador SHALL manejar respuestas correlacionadas, solicitudes de herramientas, errores, límites de tamaño, timeout y cierre.

#### Scenario: Proceso desconectado
- **WHEN** el proceso termina con solicitudes pendientes
- **THEN** todas concluyen con error controlado y se liberan los recursos.

#### Scenario: Solicitud privilegiada
- **WHEN** el servidor solicita una aprobación o herramienta no permitida
- **THEN** el cliente la rechaza sin efectos.
