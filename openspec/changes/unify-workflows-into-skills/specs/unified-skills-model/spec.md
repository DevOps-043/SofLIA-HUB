## Purpose

Definir que el producto ofrece **un solo modelo** de capacidad invocable —la
Skill— y que los Flujos de Trabajo dejan de existir como concepto paralelo. Fija
qué ocurre con los flujos que sí aportaban valor, qué desaparece porque ya está
cubierto por otro panel, y hasta dónde alcanza lo que una fila del catálogo
puede conceder ahora que las Skills asumen trabajo que antes hacía un motor
propio.

## ADDED Requirements

### Requirement: Un único modelo de capacidad invocable

El producto SHALL ofrecer las capacidades invocables exclusivamente como Skills.
MUST NOT existir una superficie de configuración, un catálogo o un canal IPC que
presente "flujos de trabajo" como una familia distinta de las Skills. El
vocabulario de la interfaz, los comandos de chat y la documentación SHALL usar
"Skill" y "Skill pasiva".

#### Scenario: La configuración ya no ofrece Flujos de Trabajo

- **WHEN** el usuario abre Ajustes → Integraciones & Skills
- **THEN** encuentra las sub-pestañas de WhatsApp, Conexiones API y Skills, y no existe una sub-pestaña de Flujos de Trabajo

#### Scenario: Un canal IPC de flujos ya no se puede invocar

- **WHEN** cualquier código del renderer intenta invocar un canal `workflow-hub:*`
- **THEN** el canal no figura en la allowlist del preload, la invocación se rechaza y no existe un handler que la atienda

### Requirement: Las aprobaciones de reuniones viven solo en Meeting Ops

El sistema SHALL presentar los casos, aprobaciones y acciones de sincronización
de reuniones en un único lugar. La bandeja duplicada del Hub de Flujos SHALL
retirarse sin pérdida de acceso: todo caso que allí figuraba SHALL seguir siendo
consultable y decidible desde Meeting Ops.

#### Scenario: Los casos pendientes siguen siendo accesibles

- **WHEN** existen casos de reunión pendientes de aprobación y el usuario abre Meeting Ops
- **THEN** el panel los lista con su resumen, sus acciones y las decisiones de aprobar, rechazar y sincronizar

#### Scenario: No hay una segunda bandeja

- **WHEN** el usuario recorre la aplicación buscando aprobaciones pendientes
- **THEN** encuentra una sola bandeja, la de Meeting Ops, y ninguna otra vista lista los mismos casos

### Requirement: Los flujos activos se ofrecen como Skills del catálogo

Las capacidades de Correo, Agenda, Seguimiento, Drive, Actualización de equipo y
PC SHALL ofrecerse como Skills del sistema declaradas en el catálogo de la base
de datos, no en el código de la aplicación. Cada una SHALL conservar su comando
de invocación actual y SHALL estar disponible para todo usuario autenticado sin
instalación ni activación por organización.

#### Scenario: Un comando de negocio sigue funcionando tras la retirada del motor

- **WHEN** el usuario escribe `/correo` en el chat del Hub o en WhatsApp
- **THEN** el sistema resuelve la Skill de Correo del catálogo, anexa sus instrucciones al turno y le concede las herramientas de lectura de correo que su superficie permite

#### Scenario: El catálogo se administra sin publicar versión

- **WHEN** se corrige el nombre, la descripción o las instrucciones de una de estas Skills en el catálogo
- **THEN** los usuarios reciben el cambio en su siguiente resolución del catálogo, sin instalar una versión nueva

#### Scenario: Una Skill de flujo no se declara en código

- **WHEN** se inspecciona el registro de Skills del sistema declarado en la aplicación
- **THEN** contiene únicamente las Skills cuyo contrato está atado a un runtime local, y las seis Skills de flujos no figuran allí

### Requirement: Una Skill de catálogo no se concede herramientas de escritura

Las Skills que sustituyen a los flujos SHALL operar con las herramientas que la
superficie ya ofrece, aportando únicamente instrucciones. El sistema MUST NOT
conceder desde una declaración de Skill ninguna herramienta que actúe hacia
fuera de la organización, altere el buzón, el calendario o Drive del usuario, o
actúe sobre su equipo. Una herramienta no concedible SHALL descartarse dejando
constancia, sin impedir que la Skill se ofrezca.

#### Scenario: La Skill de Correo revisa la bandeja

- **WHEN** el usuario invoca la Skill de Correo en una superficie que ya ofrece las herramientas de consulta de Gmail
- **THEN** la Skill revisa la bandeja con esas herramientas, sin que su declaración tenga que concederle nada

#### Scenario: Una fila pide enviar correo

- **WHEN** una fila del catálogo declara la herramienta de envío de correo
- **THEN** el sistema la descarta, deja constancia del descarte y ofrece la Skill con el resto de sus herramientas

#### Scenario: Una fila pide escribir en el buzón, el calendario o Drive

- **WHEN** una fila del catálogo declara mover a la papelera, vaciar etiquetas, aplicar un plan de organización, subir a Drive, crear una carpeta o crear o borrar un evento
- **THEN** el sistema la descarta, porque el efecto de esas herramientas no se deshace desde el chat y concederlas es una decisión del producto, no de una fila

#### Scenario: Una fila pide controlar la computadora

- **WHEN** una fila del catálogo declara la herramienta de control de la computadora o de ejecución de comandos
- **THEN** el sistema la descarta, porque conceder el equipo del usuario es una decisión del producto y no de una fila del catálogo

### Requirement: Las acciones que antes aprobaba el motor pasan al agente

Al retirarse el motor de flujos, las acciones que ejecutaba tras una aprobación
estructurada —archivar correo, aplicar etiquetas, crear carpetas, enviar a un
espacio de Chat— SHALL quedar en manos del agente, sujetas a sus propias
confirmaciones. El sistema MUST NOT ejecutar ninguna de esas acciones como
efecto implícito de invocar una Skill.

#### Scenario: El usuario pide un triage de correo

- **WHEN** el usuario invoca la Skill de Correo
- **THEN** SofLIA revisa y propone qué hacer con cada mensaje, y no archiva, etiqueta ni envía nada sin que el usuario lo pida y lo confirme

### Requirement: Retirada de los comandos de flujos en los canales

Los canales de mensajería MUST NOT ofrecer comandos de administración de flujos.
El sistema SHALL retirar `/flujos`, `/misflujos`, `/crearflujo`, `/usarflujo`,
`/ejecutarflujo`, `/pendientes`, `/aprobar` y `/rechazar`, y SHALL responder a
quien los use indicando dónde está ahora esa función.

#### Scenario: El usuario escribe un comando retirado

- **WHEN** el usuario envía `/flujos` o `/pendientes` por WhatsApp o Telegram
- **THEN** SofLIA responde que los flujos son ahora Skills, indica cómo listarlas y, para las aprobaciones, remite al panel de Reuniones de la aplicación

#### Scenario: La ayuda no anuncia comandos inexistentes

- **WHEN** el usuario pide la ayuda del canal
- **THEN** la lista de comandos no contiene ninguno de los comandos de flujos retirados
