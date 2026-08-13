## Purpose

Define cómo se resuelve el catálogo de Skills del sistema desde la base de datos
manteniéndolo disponible para todos los usuarios autenticados, qué puede declarar
cada fila y hasta dónde alcanza lo que declara, de modo que administrar el
catálogo no exija publicar una versión y una fila no pueda ampliar por su cuenta
lo que la aplicación hace en el equipo del usuario.

## ADDED Requirements

### Requirement: Catálogo del sistema en la base de datos

El sistema SHALL resolver las Skills del sistema desde un catálogo persistido en
la instancia Pulse Hub. Cada entrada SHALL declarar identificador estable,
nombre, descripción, ícono, comando, categoría, superficies, orden de
presentación, estado, prompts de inicio, instrucciones, herramientas y política
de espacio de trabajo. El catálogo SHALL estar disponible para todo usuario
autenticado sin instalación previa ni activación por organización.

#### Scenario: Todos los usuarios reciben las Skills del sistema

- **WHEN** cualquier usuario autenticado abre la biblioteca de Skills o escribe `/` en el compositor
- **THEN** el sistema ofrece las Skills del sistema del catálogo cuya superficie coincide y cuyo estado es habilitado, sin exigir que el usuario las instale ni que su organización las active

#### Scenario: Un cambio en el catálogo llega sin publicar versión

- **WHEN** se modifica el nombre, la descripción, el ícono, el comando, el orden o los prompts de inicio de una entrada del catálogo
- **THEN** los usuarios reciben el cambio en su siguiente resolución del catálogo, sin instalar una versión nueva de la aplicación

#### Scenario: Una entrada deshabilitada se retira

- **WHEN** una entrada del catálogo pasa a estado deshabilitado
- **THEN** el sistema deja de ofrecer esa Skill en todas las superficies, no la propone por comando y rechaza su invocación explicando que no está disponible

### Requirement: Escritura del catálogo restringida al servicio

El catálogo del sistema SHALL ser legible por cualquier usuario autenticado y
MUST NOT ser escribible por usuarios finales. Las operaciones de inserción,
modificación y borrado SHALL requerir credenciales de servicio que la aplicación
de escritorio no posee.

#### Scenario: Un usuario intenta escribir en el catálogo

- **WHEN** una sesión de usuario intenta insertar, modificar o eliminar una entrada del catálogo del sistema
- **THEN** la base de datos rechaza la operación y el catálogo permanece intacto

#### Scenario: La aplicación de escritorio nunca escribe el catálogo

- **WHEN** la aplicación resuelve el catálogo del sistema
- **THEN** realiza únicamente operaciones de lectura, y ninguna ruta del producto ofrece editar una Skill del sistema desde la interfaz

### Requirement: Acotado de las capacidades que declara una entrada

El sistema SHALL conceder a una Skill del catálogo únicamente las herramientas
que existen en el catálogo runtime de su superficie **y** están marcadas como
concedibles a Skills. Toda herramienta desconocida o no concedible SHALL
descartarse. La política de espacio de trabajo declarada SHALL acotarse antes de
usarse: la carpeta raíz SHALL quedar contenida en el área de trabajo de Skills,
las extensiones permitidas SHALL ser la intersección con las que el producto
admite, y los límites de tamaño SHALL topar en el máximo del producto. Un
descarte o un acotado MUST NOT impedir que la Skill se ofrezca.

#### Scenario: Una entrada pide una herramienta que no puede concederse

- **WHEN** una entrada del catálogo declara una herramienta que no existe en el catálogo runtime, o que existe pero no está marcada como concedible a Skills
- **THEN** el sistema no concede esa herramienta al turno, conserva las demás que sí puede conceder, ofrece la Skill igualmente y deja constancia del descarte en el registro de diagnóstico

#### Scenario: Una entrada pide escribir fuera del área de Skills

- **WHEN** una entrada declara una carpeta raíz absoluta, con recorrido de directorios o fuera del área de trabajo de Skills
- **THEN** el sistema no la utiliza y resuelve la Skill contra una raíz contenida en esa área

#### Scenario: Una entrada pide extensiones o tamaños fuera de lo admitido

- **WHEN** una entrada declara extensiones que el producto no admite o límites de tamaño superiores al máximo
- **THEN** el sistema conserva solo las extensiones admitidas y aplica el máximo del producto como límite efectivo

### Requirement: Respaldo en la versión instalada

El sistema SHALL conservar en la versión instalada la definición de las Skills
del sistema que trae, y SHALL usarla cuando el catálogo remoto no esté
disponible, esté vacío o no contenga una entrada conocida. La ausencia de
entradas MUST NOT retirar una Skill que la versión instalada declara. Una entrada
deshabilitada de forma explícita SÍ SHALL retirarla.

#### Scenario: La base de datos no responde

- **WHEN** la consulta del catálogo del sistema falla por red, permisos o tiempo de espera
- **THEN** el usuario conserva las Skills del sistema que trae su versión, la aplicación no muestra un error bloqueante y deja constancia del fallo en el registro de diagnóstico

#### Scenario: El catálogo todavía no tiene filas

- **WHEN** el catálogo remoto se resuelve correctamente y no devuelve ninguna entrada
- **THEN** el usuario conserva las Skills del sistema que trae su versión

#### Scenario: Retirada explícita frente a ausencia

- **WHEN** el catálogo contiene una entrada con estado deshabilitado para una Skill que la versión instalada también declara
- **THEN** el sistema retira la Skill, porque una retirada declarada manda sobre el respaldo

### Requirement: Identificadores del sistema reservados

Los identificadores de Skill del sistema SHALL constituir un espacio reservado.
Una Skill del usuario MUST NOT presentarse como Skill del sistema aunque su fila
reclame un identificador reservado, y el sistema SHALL derivar la clase de la
fuente de la que procede, nunca de un valor de la fila.

#### Scenario: Una Skill de usuario reclama un identificador del sistema

- **WHEN** una fila de Skills del usuario declara un identificador que pertenece al espacio reservado del sistema
- **THEN** el sistema la descarta del catálogo del usuario y no concede ninguna herramienta ni espacio de trabajo por ese identificador

#### Scenario: Comando en conflicto entre clases

- **WHEN** una Skill del usuario y una del sistema producen el mismo comando de invocación
- **THEN** el comando resuelve a la Skill del sistema y la del usuario sigue siendo invocable desde la biblioteca

### Requirement: Misma resolución en chat y WhatsApp

El chat del Hub y el agente de WhatsApp SHALL resolver el catálogo del sistema
con las mismas entradas, el mismo acotado de capacidades y el mismo respaldo,
filtrando cada uno por su superficie. Una Skill bloqueada para una superficie
MUST NOT ofrecerse ni ejecutarse en ella.

#### Scenario: La misma entrada en las dos superficies

- **WHEN** una entrada declara las superficies de chat y WhatsApp y está habilitada
- **THEN** ambas superficies la ofrecen con el mismo nombre, comando e instrucciones, y conceden el mismo conjunto acotado de herramientas

#### Scenario: Superficie no declarada

- **WHEN** una entrada no declara una superficie
- **THEN** esa superficie no ofrece la Skill ni permite invocarla por comando
