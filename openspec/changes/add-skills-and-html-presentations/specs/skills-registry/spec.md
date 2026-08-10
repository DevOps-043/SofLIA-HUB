## Purpose

Define el modelo único de Skill del producto: capacidades nombradas e invocables que SofLIA ofrece con el mismo contrato en el chat del Hub y en WhatsApp, distinguiendo las que provee el sistema de las que crea el usuario y acotando qué puede declarar cada clase.

## ADDED Requirements

### Requirement: Catálogo unificado de Skills

El sistema SHALL exponer un catálogo único de Skills que incluya las Skills del sistema y las Skills del usuario autenticado. Cada Skill SHALL declarar identificador estable, nombre, descripción, ícono, categoría, clase (`sistema` o `usuario`), instrucciones para el agente y prompts de inicio. El catálogo SHALL resolverse por usuario y no SHALL incluir Skills de otros usuarios.

#### Scenario: El usuario consulta su catálogo

- **WHEN** el usuario abre la biblioteca de Skills en el chat
- **THEN** el sistema muestra las Skills del sistema disponibles para su superficie y las Skills que él mismo creó, cada una con nombre, descripción, ícono y categoría

#### Scenario: Aislamiento entre usuarios

- **WHEN** un usuario solicita el catálogo
- **THEN** el sistema devuelve únicamente Skills del sistema y Skills cuyo propietario es ese usuario, y omite cualquier Skill creada por otro usuario

#### Scenario: Catálogo sin sesión

- **WHEN** no hay sesión de usuario activa
- **THEN** el sistema devuelve solo las Skills del sistema que no requieren identidad y no expone ninguna Skill de usuario

### Requirement: Clases de Skill y límites de declaración

El sistema SHALL tratar las Skills del sistema como versionadas y no editables por el usuario final, y SHALL permitir que declaren herramientas privilegiadas asociadas. Las Skills del usuario SHALL limitarse a instrucciones en lenguaje natural y prompts de inicio, y MUST NOT declarar herramientas privilegiadas, rutas del sistema de archivos, comandos ni credenciales.

#### Scenario: El usuario intenta editar una Skill del sistema

- **WHEN** el usuario intenta modificar o eliminar una Skill del sistema desde la biblioteca
- **THEN** el sistema rechaza la operación, mantiene la Skill intacta y explica que las Skills del sistema se actualizan con el producto

#### Scenario: Una Skill de usuario intenta declarar herramientas

- **WHEN** el usuario guarda una Skill cuyo contenido pretende habilitar una herramienta privilegiada
- **THEN** el sistema guarda solo las instrucciones y prompts, no habilita ninguna herramienta adicional para esa Skill, y el agente conserva exactamente el conjunto de herramientas de la superficie

#### Scenario: Skill del sistema con herramientas asociadas

- **WHEN** el usuario activa una Skill del sistema que declara herramientas
- **THEN** el agente recibe únicamente las herramientas declaradas por esa Skill además de las de la superficie, y ninguna herramienta bloqueada para esa superficie

### Requirement: Invocación de Skills desde el chat del Hub

El sistema SHALL permitir activar una Skill desde el chat. Mientras una Skill está activa, sus instrucciones SHALL incorporarse a la instrucción de sistema del turno y SHALL ser visibles para el usuario como estado activo. El usuario SHALL poder desactivarla y volver al comportamiento base sin perder la conversación.

#### Scenario: Activación de una Skill

- **WHEN** el usuario selecciona una Skill de la biblioteca
- **THEN** el chat indica que la Skill está activa y los mensajes siguientes se procesan con las instrucciones de esa Skill

#### Scenario: Desactivación de una Skill

- **WHEN** el usuario desactiva la Skill activa
- **THEN** los mensajes siguientes se procesan sin las instrucciones de la Skill y la conversación conserva todo su historial

#### Scenario: Prompt de inicio

- **WHEN** el usuario elige un prompt de inicio de una Skill
- **THEN** el texto se coloca en el compositor del chat con la Skill activada, y el usuario puede editarlo antes de enviarlo

### Requirement: Invocación por comando desde el compositor

El usuario SHALL poder invocar cualquier Skill de su catálogo escribiendo `/`
seguido del comando de la Skill en el compositor del chat, tanto en el chat
completo como en el chat flotante del navegador. El comando de una Skill del
usuario SHALL derivarse de su nombre; una Skill del sistema SHALL poder
declarar el suyo para que no dependa de su nombre. Un texto que contenga
espacios MUST NOT tratarse como comando.

#### Scenario: El usuario abre el catálogo de comandos

- **WHEN** el usuario escribe `/` como primer carácter del compositor
- **THEN** el chat muestra las Skills disponibles con su comando y descripción, y permite recorrerlas con el teclado

#### Scenario: Invocación de una Skill del sistema

- **WHEN** el usuario escribe el comando completo de una Skill del sistema y confirma
- **THEN** esa Skill queda activa, el compositor se vacía y el comando no se envía como mensaje al modelo

#### Scenario: Invocación de una Skill recién creada por el usuario

- **WHEN** el usuario crea una Skill llamada "Resumen ejecutivo" y después escribe su comando en el compositor
- **THEN** la Skill se ofrece y se activa sin que el usuario haya tenido que configurar ningún comando

#### Scenario: Texto que solo empieza por barra

- **WHEN** el usuario escribe una barra seguida de texto con espacios
- **THEN** el chat no lo trata como comando y el mensaje se envía normalmente

#### Scenario: Comando ambiguo entre dos Skills

- **WHEN** una Skill del usuario produciría el mismo comando que una del sistema
- **THEN** el comando resuelve siempre a la Skill del sistema y la del usuario permanece accesible desde la biblioteca

### Requirement: Invocación de Skills desde WhatsApp

El sistema SHALL permitir invocar por WhatsApp las Skills del sistema habilitadas para esa superficie, conservando las guardas de WhatsApp vigentes. Las Skills bloqueadas en grupos MUST NOT ejecutarse en conversaciones de grupo.

#### Scenario: Invocación de una Skill del sistema por WhatsApp

- **WHEN** el usuario envía por WhatsApp el comando de una Skill del sistema habilitada para esa superficie
- **THEN** SofLIA ejecuta la Skill con las guardas de WhatsApp y responde por el mismo canal

#### Scenario: Skill no habilitada para WhatsApp

- **WHEN** el usuario invoca por WhatsApp una Skill que no está habilitada para esa superficie
- **THEN** SofLIA no la ejecuta y responde indicando en qué superficie está disponible

#### Scenario: Skill restringida en grupo

- **WHEN** una Skill bloqueada en grupos se invoca desde una conversación de grupo
- **THEN** el sistema rechaza la ejecución e informa la restricción sin filtrar datos de la conversación individual

### Requirement: Configuración de Skills del usuario

El sistema SHALL ofrecer una superficie de configuración donde el usuario cree,
edite y elimine sus Skills, definiendo nombre, comando de invocación, icono,
instrucciones y prompts de inicio. El comando SHALL derivarse del nombre cuando
el usuario no indique uno. El sistema MUST NOT permitir que dos Skills del mismo
usuario compartan comando. Las Skills del sistema SHALL mostrarse como
referencia con su comando, sin acciones de edición.

#### Scenario: Creación desde la configuración

- **WHEN** el usuario crea una Skill indicando nombre, icono e instrucciones
- **THEN** la Skill queda guardada con esos valores y su comando queda visible

#### Scenario: Comando derivado del nombre

- **WHEN** el usuario escribe un nombre y deja el comando vacío
- **THEN** la interfaz muestra el comando que se derivará del nombre antes de guardar

#### Scenario: Comando en conflicto

- **WHEN** el usuario intenta usar un comando que ya pertenece a otra Skill suya o del sistema
- **THEN** el sistema avisa del conflicto y no guarda la Skill

#### Scenario: Edición conservando el propio comando

- **WHEN** el usuario edita una Skill sin cambiar su comando
- **THEN** el sistema no lo trata como conflicto consigo misma y guarda los cambios

#### Scenario: Skill del sistema en la configuración

- **WHEN** el usuario abre la configuración de Skills
- **THEN** ve las del sistema con su comando y sin controles para editarlas o eliminarlas

### Requirement: Identidad visual de las Skills

El icono de una Skill SHALL guardarse como identificador de un catálogo cerrado
de iconos del producto, no como carácter gráfico. Un icono no reconocido SHALL
resolverse al icono por defecto en lugar de mostrarse tal cual.

#### Scenario: Selección de icono

- **WHEN** el usuario elige un icono al crear o editar una Skill
- **THEN** ese icono aparece en la configuración, en la biblioteca y en el menú de comandos

#### Scenario: Icono heredado de una herramienta anterior

- **WHEN** una Skill conserva un icono guardado por el modelo anterior que no pertenece al catálogo
- **THEN** el sistema muestra el icono por defecto en vez de ese valor

### Requirement: Prompts de inicio

Una Skill SHALL poder declarar prompts de inicio. Al activarse una Skill que los
tenga, el sistema SHALL ofrecerlos al usuario; elegir uno SHALL colocarlo en el
compositor sin enviarlo.

#### Scenario: Sugerencias tras activar la Skill

- **WHEN** el usuario activa una Skill que declara prompts de inicio y el compositor está vacío
- **THEN** el chat muestra esos prompts como sugerencias

#### Scenario: Uso de una sugerencia

- **WHEN** el usuario elige una sugerencia
- **THEN** el texto queda en el compositor sin enviarse, y puede editarlo antes de mandarlo

#### Scenario: El usuario ya escribió

- **WHEN** el compositor tiene texto escrito
- **THEN** las sugerencias no se muestran

### Requirement: Persistencia de Skills del usuario

El sistema SHALL persistir las Skills del usuario con aislamiento por propietario aplicado en la base de datos. Una Skill del usuario SHALL requerir nombre e instrucciones no vacíos. El sistema SHALL registrar el uso de cada Skill para poder ordenarlas por uso y por favorito.

#### Scenario: Creación válida

- **WHEN** el usuario guarda una Skill con nombre e instrucciones
- **THEN** el sistema la persiste asociada a su identidad y la muestra en su biblioteca

#### Scenario: Creación inválida

- **WHEN** el usuario intenta guardar una Skill sin nombre o sin instrucciones
- **THEN** el sistema rechaza el guardado, no crea ningún registro y señala el campo faltante

#### Scenario: Acceso directo a Skills ajenas

- **WHEN** una petición intenta leer o modificar una Skill cuyo propietario es otro usuario
- **THEN** la base de datos deniega la operación y el sistema no revela la existencia del registro

### Requirement: Migración desde herramientas del usuario

El sistema SHALL migrar las herramientas del usuario existentes al modelo de Skills conservando nombre, descripción, ícono, categoría, instrucciones, prompts de inicio, marca de favorito y contador de uso. La migración SHALL ser idempotente y no SHALL duplicar registros si se ejecuta más de una vez.

#### Scenario: Migración de datos existentes

- **WHEN** se aplica la migración sobre una base con herramientas del usuario registradas
- **THEN** cada herramienta aparece como una Skill del usuario con los mismos campos y el mismo propietario

#### Scenario: Migración repetida

- **WHEN** la migración se ejecuta una segunda vez sobre la misma base
- **THEN** el conjunto de Skills resultante es idéntico al de la primera ejecución y no se crean duplicados

## REMOVED Requirements

### Requirement: Herramientas del usuario como modelo separado

**Reason**: Las herramientas del usuario y los flujos activos de WhatsApp resolvían el mismo problema con dos modelos incompatibles que no se podían invocar entre superficies.

**Migration**: Los registros existentes se migran automáticamente a Skills del usuario conservando todos sus campos. La UI de "Mis Herramientas" pasa a ser la biblioteca de Skills sin acción del usuario.
