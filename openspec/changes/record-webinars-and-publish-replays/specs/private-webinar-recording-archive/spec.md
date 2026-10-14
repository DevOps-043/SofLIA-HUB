## Purpose

Conservar y procesar las grabaciones de webinars en archivo privado autorizado,
con integridad, segmentos y recuperación ante fallos de eventos, red y almacenamiento.

## ADDED Requirements

### Requirement: RF-WARC-001 Recepción autenticada y duradera
Learning SHALL extender el webhook existente, validar firma del cuerpo original,
frescura y cuenta, correlacionar sesión/host/UUID y persistir recibo/job antes del
ACK. Descarga y conversión no SHALL ejecutarse dentro de la respuesta al webhook.
Eventos huérfanos no SHALL asignarse por título ni crear contenido público.

#### Scenario: Firma incorrecta o cuenta ajena
- **WHEN** un callback no acredita firma/cuenta autorizadas
- **THEN** se rechaza sin crear ni modificar grabaciones

#### Scenario: Webhook repetido
- **WHEN** el mismo archivo/instancia se notifica varias veces
- **THEN** una restricción única y transiciones idempotentes evitan copias y jobs duplicados

### Requirement: RF-WARC-002 Importación íntegra y privada
El worker SHALL copiar con memoria acotada, checkpoints y validación de URL,
redirecciones, tamaño, tipo y legibilidad. SHALL confirmar el asset solo después
de finalizar y validar la copia. Tokens y URLs de descarga del proveedor no SHALL
exponerse al renderer, alumno o logs. Una subida parcial no SHALL ser ready.

#### Scenario: Archivo grande o transferencia interrumpida
- **WHEN** falla una copia de grabación durante la transferencia
- **THEN** queda un job reintentable con estado parcial privado y ningún vídeo público

#### Scenario: Token de descarga vencido
- **WHEN** el worker recibe un rechazo por autorización caducada
- **THEN** recupera autorización por API y reintenta dentro del presupuesto, sin token en URL

### Requirement: RF-WARC-003 Ejecuciones y segmentos completos
El archivo SHALL distinguir UUIDs de ejecución y archivos/intervalos de una
grabación. SHALL reconciliar callbacks faltantes por API antes de acreditar una
edición completa. Una misma reunión recurrente no SHALL mezclar webinars de días distintos.

#### Scenario: Más de un segmento
- **WHEN** el webinar genera varios segmentos válidos por paradas/reinicios
- **THEN** la edición conserva su orden y cobertura y no se reduce silenciosamente al primer MP4

#### Scenario: Llega completed antes de terminar el evento
- **WHEN** se completa un segmento y el webinar aún está activo
- **THEN** se importa privado y se espera reconciliación final para considerar completa la edición

### Requirement: RNF-WARC-001 Retención y observabilidad independientes
Grabaciones SHALL tener cuota, presupuestos, métricas, auditoría y retención
independientes del bucket de materiales y del GC del estudio. Purgas SHALL seguir
política administrativa autorizada, hold y ledger; no SHALL destruir el original
de Zoom antes de acreditar copia íntegra y permiso de retención.

#### Scenario: Webinar cerrado sin publicación
- **WHEN** termina un webinar cuyo instructor no habilita repetición
- **THEN** se conserva privado según la política del archivo, sin publicarlo ni aplicar
  automáticamente el GC de materiales de la sesión
