## Purpose

Definir la **Skill pasiva**: una programación que ejecuta una Skill del catálogo
—o un prompt libre recordado— sin que el usuario la pida en ese momento, y que
entrega el resultado por los canales que el usuario eligió. Sustituye al
"workflow pasivo" conservando lo que ya funcionaba: la creación conversacional
desde el canal, la programación por cron y la negativa a programar a mano lo que
el sistema ya detecta solo.

## ADDED Requirements

### Requirement: Modelo de Skill pasiva

Una Skill pasiva SHALL declarar nombre, descripción, programación, el prompt que
se ejecuta y los canales de entrega. SHALL poder referenciar una Skill del
catálogo o ninguna, en cuyo caso ejecuta un prompt libre. El sistema SHALL
rechazar una Skill pasiva sin nombre o sin una programación válida, explicando
qué falta.

#### Scenario: Se guarda una Skill pasiva sobre una Skill del catálogo

- **WHEN** el usuario programa una rutina que referencia una Skill del catálogo con una programación válida
- **THEN** el sistema la guarda, la deja activa y confirma cuándo se ejecutará y por dónde llegará

#### Scenario: Se guarda una rutina libre

- **WHEN** el usuario programa una rutina que no corresponde a ninguna Skill del catálogo
- **THEN** el sistema la guarda como rutina libre, ejecuta el prompt recordado a su hora y no exige elegir una Skill

#### Scenario: Programación inválida

- **WHEN** el usuario intenta guardar una Skill pasiva sin nombre o con una programación que el sistema no puede interpretar
- **THEN** el sistema rechaza el guardado, no crea ninguna tarea y explica qué dato falta

### Requirement: Creación conversacional desde un canal

El usuario SHALL poder crear una Skill pasiva describiéndola en lenguaje natural
desde un canal de mensajería privado. El sistema SHALL extraer el momento de
ejecución y el propósito, guardarla sin exigir sintaxis de comando, y confirmar
qué guardó. MUST NOT crearse una Skill pasiva desde una conversación de grupo.

#### Scenario: El usuario describe una rutina por chat

- **WHEN** el usuario escribe por privado que quiere recibir las noticias de IA más relevantes cada día a las 8 de la mañana
- **THEN** el sistema guarda una Skill pasiva con esa programación, confirma el nombre, el momento y los canales de entrega, y no vuelve a pedir el mismo dato por comando

#### Scenario: Petición en un grupo

- **WHEN** la misma petición llega en una conversación de grupo
- **THEN** el sistema no crea ninguna Skill pasiva

### Requirement: Las detecciones automáticas no se programan a mano

El sistema SHALL rechazar la programación manual de una capacidad que ya se
ejecuta sola en segundo plano, explicando que no necesita programación. La
capacidad SHALL seguir apareciendo listada, marcada como automática, para que el
usuario sepa que existe y no la busque.

#### Scenario: Se intenta programar una detección automática

- **WHEN** el usuario intenta programar una capacidad cuyo comportamiento pasivo es una detección del sistema
- **THEN** el sistema rechaza el guardado y explica que ya corre automáticamente

#### Scenario: La capacidad automática sigue siendo visible

- **WHEN** el usuario consulta sus Skills pasivas
- **THEN** las detecciones automáticas del sistema figuran identificadas como tales, sin controles de programación

### Requirement: Administración de las Skills pasivas desde la aplicación

El usuario SHALL poder consultar, crear, modificar y eliminar sus Skills pasivas
desde la aplicación, viendo para cada una su programación en lenguaje claro, su
última ejecución y sus canales de entrega. Eliminar una Skill pasiva SHALL
detener su ejecución de inmediato.

#### Scenario: El usuario revisa sus Skills pasivas

- **WHEN** el usuario abre la sección de Skills en la configuración
- **THEN** ve sus Skills pasivas con nombre, cuándo se ejecutan, cuándo se ejecutaron por última vez y en qué canales entregan

#### Scenario: El usuario elimina una Skill pasiva

- **WHEN** el usuario elimina una Skill pasiva
- **THEN** el sistema cancela su programación, no vuelve a ejecutarla y deja de listarla

### Requirement: Ejecución sin confirmaciones repetidas

Al dispararse, una Skill pasiva SHALL ejecutarse sin volver a pedir la
autorización que el usuario ya dio al programarla. Un fallo de ejecución MUST
NOT detener la programación: la Skill SHALL seguir activa para su siguiente
disparo y el fallo SHALL quedar en el registro de diagnóstico.

#### Scenario: Llega la hora programada

- **WHEN** se cumple la programación de una Skill pasiva
- **THEN** el sistema la ejecuta sin pedir confirmación al usuario y entrega el resultado por sus canales

#### Scenario: La ejecución falla

- **WHEN** la ejecución de una Skill pasiva falla por red, permisos o un error del proveedor
- **THEN** el sistema deja constancia del fallo, no elimina la programación y vuelve a intentarlo en el siguiente disparo

### Requirement: Continuidad de las rutinas ya programadas

Las programaciones creadas con el modelo anterior de workflows pasivos SHALL
seguir ejecutándose tras la actualización, sin que el usuario tenga que volver a
crearlas. Una programación sin canales declarados SHALL entregarse por el canal
desde el que se creó.

#### Scenario: Una rutina anterior sobrevive a la actualización

- **WHEN** el usuario actualiza la aplicación teniendo workflows pasivos programados
- **THEN** esas programaciones aparecen como Skills pasivas, conservan su hora y su propósito, y se ejecutan igual

#### Scenario: Una rutina anterior no declara canales

- **WHEN** se dispara una programación creada antes de que existieran los canales
- **THEN** el sistema la entrega por el canal desde el que se creó, sin quedarse sin destino
