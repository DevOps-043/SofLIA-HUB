## ADDED Requirements

### Requirement: Conexión diferida y única
El servicio SHALL cargar el SDK WhatsApp al conectar y SHALL compartir la preparación simultánea mientras la sesión siga vigente.

#### Scenario: Construcción sin conexión
- **WHEN** se importa y construye el servicio
- **THEN** no se carga el SDK del transporte

#### Scenario: Conexión cancelada durante preparación
- **WHEN** se desconecta o cambia la sesión antes de terminar la preparación
- **THEN** el intento antiguo no crea un socket ni invalida uno nuevo

### Requirement: Reintentos y errores controlados
El sistema SHALL cancelar reintentos al desconectar o cambiar sesión y SHALL contener los rechazos de callbacks de conexión y credenciales.

#### Scenario: Timer pendiente y desconexión manual
- **WHEN** se desconecta con un reintento pendiente
- **THEN** no se reconecta posteriormente por ese timer

### Requirement: Streaming completo con publicaciones agrupadas
El renderer SHALL conservar todos los fragmentos, metadatos y herramientas mientras limita las publicaciones visuales intermedias.

#### Scenario: Ráfaga de fragmentos
- **WHEN** llegan muchos fragmentos antes de 50 ms
- **THEN** se agrupan publicaciones sin perder texto final y el primer fragmento puede mostrarse inmediatamente

#### Scenario: Stop o sustitución del turno
- **WHEN** el turno se cancela o es sustituido
- **THEN** no publica cambios sobre un turno nuevo y resuelve el placeholder vigente
