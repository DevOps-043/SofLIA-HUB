## ADDED Requirements

### Requirement: Agenda integrada
Hub SHALL ofrecer Sesiones síncronas debajo de Navegador y Reuniones y consultar solo sesiones autorizadas de la organización activa.

#### Scenario: Abrir una clase
- **WHEN** el usuario selecciona una sesión de la agenda
- **THEN** Hub muestra el aula independiente correspondiente al rol confirmado por Learning, sin abrir navegador, chat general ni medios Zoom

#### Scenario: Fallo de consulta
- **WHEN** Learning no está disponible
- **THEN** Hub muestra un error recuperable sin sesiones inventadas

#### Scenario: Autenticación de escritorio
- **WHEN** Hub consulta la agenda con su bearer y sin cookies web
- **THEN** el filtro de Learning delega la autenticación al handler del catálogo, que verifica identidad y membresía
- **AND** la consulta usa el presupuesto de sesiones, separado de los intentos de login

#### Scenario: Diagnóstico de acceso
- **WHEN** Learning devuelve 401, 404, 405, 429 o un fallo del servidor
- **THEN** Hub distingue sesión no validada, integración no habilitada e indisponibilidad sin atribuir falta de permisos
- **AND** solo un 403 remoto se presenta como denegación de acceso a la organización

### Requirement: Aula independiente
El aula SHALL ocupar el área de trabajo con controles para volver a la agenda o cerrar. El lienzo del participante permanece vacío; el estudio del instructor se define en design-instructor-live-studio.

#### Scenario: Abrir el aula con el navegador activo
- **WHEN** se selecciona una sesión o llega una referencia académica mientras el navegador está abierto
- **THEN** el aula sustituye al navegador y al chat sin cerrar ni navegar sus pestañas
- **AND** no monta el panel de agentes ni la barra lateral de conversaciones

#### Scenario: Contenido anterior eliminado
- **WHEN** el usuario abre el aula
- **THEN** no aparecen la antesala ni Participar, Pulse Checks e Información del diseño anterior
- **AND** solo se consulta un snapshot para confirmar el rol, sin sondeo colaborativo ni acceso a Zoom

#### Scenario: Regresar a las sesiones
- **WHEN** el usuario vuelve o cierra el aula
- **THEN** vuelve a la agenda y el navegador no se abre automáticamente
