## ADDED Requirements

### Requirement: Entrada flotante mínima
El sistema SHALL conservar la autenticación, voz y reuniones del avatar sin montar gestores de conversaciones, carpetas o proyectos del shell principal.

#### Scenario: Abrir avatar flotante
- **WHEN** la entrada recibe el modo orb
- **THEN** monta únicamente la superficie flotante y sus proveedores necesarios

### Requirement: Sincronización sin trabajo redundante
El renderer SHALL agrupar eventos de refresco y MUST impedir consultas periódicas de vista oculta y solicitudes solapadas del mismo controlador.

#### Scenario: Ventana oculta y eventos remotos
- **WHEN** la ventana está oculta y recibe invalidaciones
- **THEN** conserva la invalidación sin iniciar consultas hasta volver a visible

#### Scenario: Solicitud lenta y ráfaga de eventos
- **WHEN** una solicitud sigue en curso mientras llegan eventos adicionales
- **THEN** ejecuta como máximo una solicitud simultánea y una recuperación agrupada posterior

#### Scenario: Desmontaje o cambio de ámbito
- **WHEN** se retira un controlador
- **THEN** retira timers y listeners y no publica respuestas obsoletas

### Requirement: Funciones disponibles bajo demanda
El sistema SHALL mantener accesibles las superficies diferidas y el contenido completo de mensajes históricos.

#### Scenario: Entrar a una superficie diferida
- **WHEN** el usuario selecciona esa función
- **THEN** carga su módulo y presenta espera mientras se resuelve
