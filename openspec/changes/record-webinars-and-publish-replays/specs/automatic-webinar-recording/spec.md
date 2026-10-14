## Purpose

Exigir y observar la grabación de webinars propios de Soflia mediante Zoom cloud,
con verificación de capacidad y recuperación sin depender del escritorio del instructor.

## ADDED Requirements

### Requirement: RF-WREC-001 Política de grabación obligatoria
Learning SHALL exigir grabación automática cloud para los webinars del producto,
soportando ambos tipos remotos meeting/webinar. El instructor no SHALL poder
desactivarla mediante la preferencia de disponibilidad posterior. La política
no SHALL modificar reuniones ajenas al producto.

#### Scenario: Evento nuevo
- **WHEN** un instructor programa un webinar de Soflia
- **THEN** el servidor configura y verifica automático cloud en el recurso remoto

#### Scenario: Evento ya programado
- **WHEN** se activa el sistema con webinars pendientes existentes
- **THEN** se auditan individualmente y se aplica un backfill idempotente aprobado,
  sin suponer que una preferencia de cuenta ya los cubre

### Requirement: RF-WREC-002 Admisión y estado real
El servidor SHALL comprobar host, acceso, licencia/capacidad, permisos y
configuración antes de habilitar el inicio desde Soflia. La UI SHALL mostrar
Grabando solo ante evidencia del proveedor, y distinguir preparado, interrumpido,
procesando, listo y fallido. Un comando SDK exitoso no SHALL acreditar vídeo guardado.

#### Scenario: Capacidad cloud no disponible
- **WHEN** el host no tiene licencia/capacidad o el evento es incompatible con cloud
- **THEN** se informa el motivo y no se presenta como listo para grabación obligatoria

#### Scenario: Ausencia de confirmación
- **WHEN** se inicia el webinar y no llega evidencia de grabación en el plazo configurado
- **THEN** se muestra una alerta y se inicia recuperación acotada, sin inventar Grabando

### Requirement: RF-WREC-003 Independencia y cobertura
La captura SHALL ser del proveedor y registrar interrupciones y ejecuciones.
Cerrar Hub no SHALL cancelar por sí solo una grabación si el evento Zoom continúa.
Una terminación real del webinar no SHALL presentarse como captura continua.
La aplicación SHALL mostrar aviso de grabación y respetar política de consentimiento.

#### Scenario: Instructor sale del escritorio
- **WHEN** Hub se desconecta y el webinar sigue activo en Zoom
- **THEN** la captura y su recuperación posterior no dependen de ese proceso Electron

#### Scenario: Grabación interrumpida
- **WHEN** el proveedor detiene o pausa la captura durante el webinar
- **THEN** se registra el hueco y se informa la incidencia; no se afirma recuperación
  retroactiva de contenido inexistente
