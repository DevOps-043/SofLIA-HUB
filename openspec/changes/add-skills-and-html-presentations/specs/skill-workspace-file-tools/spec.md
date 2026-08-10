## Purpose

Define las herramientas de archivo que una Skill del sistema puede usar para escribir y editar el código de su entregable, acotadas al workspace de esa Skill para que el modelo pueda crear y modificar archivos sin obtener acceso libre al disco del usuario.

## ADDED Requirements

### Requirement: Herramientas acotadas al workspace de la Skill activa

El sistema SHALL ofrecer al agente herramientas para listar, leer, escribir y editar archivos únicamente dentro del workspace de la Skill activa. Las herramientas SHALL estar disponibles solo mientras existe un workspace activo y MUST NOT ofrecerse cuando ninguna Skill con workspace está en curso.

#### Scenario: Escritura dentro del workspace

- **WHEN** el agente escribe un archivo con una ruta dentro del workspace activo
- **THEN** el sistema crea o reemplaza el archivo y devuelve el resultado de la operación

#### Scenario: Sin workspace activo

- **WHEN** no hay ninguna Skill con workspace en curso
- **THEN** las herramientas de archivo del workspace no se ofrecen al modelo y cualquier invocación se rechaza

#### Scenario: Listado del workspace

- **WHEN** el agente lista el contenido del workspace
- **THEN** el sistema devuelve solo los archivos y carpetas de ese workspace, sin revelar rutas absolutas del sistema del usuario

### Requirement: Validación de rutas

Toda ruta recibida SHALL resolverse y validarse contra el workspace activo antes de cualquier operación. El sistema MUST rechazar rutas que escapen del workspace, incluidas rutas relativas con segmentos superiores, rutas absolutas fuera del workspace y enlaces simbólicos que apunten fuera de él.

#### Scenario: Ruta que escapa por segmentos relativos

- **WHEN** el agente solicita escribir en una ruta que sale del workspace mediante segmentos superiores
- **THEN** el sistema rechaza la operación, no crea ni modifica ningún archivo y devuelve un error explícito

#### Scenario: Ruta absoluta fuera del workspace

- **WHEN** el agente solicita leer una ruta absoluta que no pertenece al workspace activo
- **THEN** el sistema rechaza la operación y no devuelve el contenido

#### Scenario: Enlace simbólico hacia fuera

- **WHEN** una ruta del workspace resuelve mediante un enlace simbólico a una ubicación externa
- **THEN** el sistema rechaza la operación y no sigue el enlace

### Requirement: Edición por reemplazo exacto

El sistema SHALL ofrecer una edición que reemplace una porción exacta del contenido de un archivo existente. La edición SHALL fallar sin modificar el archivo cuando el texto buscado no existe o aparece más de una vez, salvo que la invocación pida explícitamente reemplazar todas las ocurrencias.

#### Scenario: Reemplazo exitoso

- **WHEN** el agente reemplaza un fragmento que aparece una sola vez en el archivo
- **THEN** el sistema aplica el cambio y conserva el resto del archivo sin alteraciones

#### Scenario: Fragmento inexistente

- **WHEN** el fragmento a reemplazar no existe en el archivo
- **THEN** el sistema no modifica el archivo y devuelve un error que lo indica

#### Scenario: Fragmento ambiguo

- **WHEN** el fragmento a reemplazar aparece más de una vez y la invocación no pide reemplazar todas las ocurrencias
- **THEN** el sistema no modifica el archivo y devuelve un error que indica la ambigüedad

### Requirement: Límites de tamaño y extensión

El sistema SHALL aplicar un límite máximo de tamaño por archivo y por workspace, y SHALL restringir las extensiones que la Skill puede escribir a las declaradas por esa Skill. Superar un límite SHALL interrumpir la operación con un error, sin dejar archivos parcialmente escritos.

#### Scenario: Archivo que excede el límite

- **WHEN** el agente intenta escribir un contenido que supera el límite de tamaño por archivo
- **THEN** el sistema rechaza la escritura, no deja un archivo parcial y devuelve un error que indica el límite

#### Scenario: Extensión no declarada

- **WHEN** el agente intenta escribir un archivo con una extensión no declarada por la Skill activa
- **THEN** el sistema rechaza la operación y no crea el archivo

#### Scenario: Workspace que alcanza su límite

- **WHEN** una escritura haría que el workspace supere su límite total
- **THEN** el sistema rechaza esa escritura e informa que el workspace alcanzó su límite

### Requirement: Incorporación de imágenes al workspace

El sistema SHALL permitir que la Skill activa incorpore imágenes a su workspace, generándolas con el modelo de imagen del producto o descargándolas de una dirección pública. Toda imagen SHALL guardarse dentro de la carpeta de recursos del workspace con un nombre saneado por el sistema, y su formato SHALL restringirse a los mapas de bits admitidos. La descarga SHALL ejecutarse en el proceso principal, que MUST rechazar direcciones sin cifrar y destinos de red privada o enlace-local, revalidando cada redirección antes de seguirla.

#### Scenario: Imagen generada

- **WHEN** el agente pide generar una imagen para la presentación
- **THEN** el sistema la genera, la guarda en la carpeta de recursos del workspace y devuelve la ruta relativa que el documento debe referenciar

#### Scenario: Nombre con ruta

- **WHEN** el nombre propuesto para la imagen incluye segmentos de ruta o caracteres no admitidos
- **THEN** el sistema descarta esa ruta, guarda la imagen dentro de la carpeta de recursos con el nombre saneado y no escribe fuera del workspace

#### Scenario: Formato no admitido

- **WHEN** la imagen propuesta o descargada no corresponde a un formato de mapa de bits admitido
- **THEN** el sistema rechaza la operación y no escribe ningún archivo

#### Scenario: Descarga hacia un destino interno

- **WHEN** la dirección indicada apunta a una red privada o de enlace local, o una redirección lleva a ella
- **THEN** el sistema rechaza la descarga sin emitir la petición a ese destino y devuelve un error al agente

#### Scenario: Imagen que excede el límite

- **WHEN** la imagen supera el tamaño máximo permitido o haría que el workspace superara su límite total
- **THEN** el sistema rechaza la operación y no deja un archivo parcial

### Requirement: Progreso observable de las operaciones

Cada operación de escritura o edición SHALL emitir un evento observable por la interfaz que identifique el archivo afectado y el estado de la operación, para que el usuario pueda seguir el trabajo mientras ocurre.

#### Scenario: Evento al escribir

- **WHEN** el agente escribe o edita un archivo del workspace
- **THEN** la interfaz recibe un evento con el archivo afectado y puede reflejar el avance sin consultar el disco

#### Scenario: Evento al fallar

- **WHEN** una operación de archivo falla
- **THEN** la interfaz recibe un evento de error asociado a ese archivo y el usuario ve que esa operación no se completó
