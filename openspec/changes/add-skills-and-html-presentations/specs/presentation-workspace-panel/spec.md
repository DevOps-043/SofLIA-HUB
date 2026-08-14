## Purpose

Describe la superficie donde el usuario observa y controla la creación de una presentación: ve en vivo qué archivo escribe SofLIA, reproduce el resultado sin salir del chat, lo abre a pantalla completa para presentar, y puede ocultar todo el panel sin detener el trabajo.

## ADDED Requirements

### Requirement: Panel lateral de trabajo de la presentación

El sistema SHALL mostrar un panel lateral derecho mientras una presentación está en curso o abierta, con la lista de archivos del proyecto y el contenido del archivo seleccionado. El panel SHALL convivir con el chat sin sustituirlo y SHALL conservar la conversación visible.

#### Scenario: Apertura automática al generar

- **WHEN** SofLIA comienza a generar una presentación
- **THEN** el panel de trabajo se abre en el lado derecho, el chat sigue visible y utilizable, y el panel lista los archivos del proyecto

#### Scenario: Selección de archivo

- **WHEN** el usuario selecciona un archivo de la lista del panel
- **THEN** el panel muestra el contenido de ese archivo y conserva la selección mientras la generación continúa

### Requirement: Escritura de código visible en vivo

El panel SHALL reflejar el progreso de escritura mientras SofLIA genera o modifica archivos, indicando qué archivo está en curso. El usuario SHALL poder seguir leyendo el chat y enviando mensajes mientras la escritura ocurre.

#### Scenario: Progreso durante la generación

- **WHEN** SofLIA escribe un archivo de la presentación
- **THEN** el panel señala ese archivo como el archivo en curso y muestra su contenido actualizado sin que el usuario recargue nada

#### Scenario: Escritura terminada

- **WHEN** SofLIA termina de escribir todos los archivos
- **THEN** el panel deja de señalar archivos en curso y habilita la reproducción de la presentación

#### Scenario: Interacción durante la escritura

- **WHEN** el usuario envía un mensaje mientras la generación está en curso
- **THEN** el chat acepta el mensaje y el panel conserva el progreso mostrado

### Requirement: Reproducción y vista previa embebida

El panel SHALL ofrecer un control de reproducción que renderiza la presentación generada. La vista previa embebida SHALL ejecutarse aislada: MUST NOT tener acceso a la mensajería interna de la aplicación, a las APIs privilegiadas del producto ni a orígenes de red externos, y SHALL servir únicamente archivos de la carpeta del proyecto.

#### Scenario: Reproducir la presentación

- **WHEN** el usuario acciona el control de reproducción
- **THEN** el sistema muestra la presentación renderizada dentro de la aplicación, sin abrir un navegador externo

#### Scenario: Descargar el deck en vista previa y desarrollo

- **WHEN** el iframe aislado o la ventana React servida por el origen Vite configurado solicita `deck.json`
- **THEN** el servidor loopback autoriza exactamente ese origen y entrega el deck, la marca y sus recursos

#### Scenario: Un sitio ajeno intenta leer el deck

- **WHEN** un origen distinto del iframe opaco y del origen Vite configurado solicita un recurso de la sesión
- **THEN** el servidor omite la autorización CORS y el navegador deniega la lectura

#### Scenario: Aislamiento de la vista previa

- **WHEN** la presentación renderizada intenta acceder a las APIs privilegiadas del producto o solicitar un recurso de un origen externo
- **THEN** el acceso se deniega, la presentación sigue mostrándose y el intento no afecta al resto de la aplicación

#### Scenario: Solicitud de un archivo fuera del proyecto

- **WHEN** la presentación renderizada solicita un archivo fuera de la carpeta del proyecto
- **THEN** el sistema deniega la solicitud y no entrega el archivo

#### Scenario: Reproducción sin archivos

- **WHEN** el usuario acciona el control de reproducción antes de que exista un documento renderizable
- **THEN** el sistema informa que la presentación aún no está lista y no abre una vista vacía

### Requirement: Vista a pantalla completa para presentar

El usuario SHALL poder abrir la presentación a pantalla completa para presentarla. La vista a pantalla completa SHALL conservar el mismo aislamiento que la vista previa embebida y SHALL poder cerrarse devolviendo al usuario al panel y al chat en el estado en que los dejó.

#### Scenario: Abrir a pantalla completa

- **WHEN** el usuario pide presentar a pantalla completa
- **THEN** el sistema muestra la presentación ocupando la ventana y permite navegar entre diapositivas

#### Scenario: Cerrar la pantalla completa

- **WHEN** el usuario cierra la vista a pantalla completa
- **THEN** el sistema vuelve al panel de trabajo y al chat con la conversación y la selección de archivo intactas

### Requirement: Ocultar y recuperar el panel

El usuario SHALL poder ocultar el panel de trabajo sin cancelar la generación en curso, y SHALL poder volver a mostrarlo desde el menú de herramientas del encabezado del chat, junto a las demás superficies del producto. El estado oculto SHALL conservarse mientras dure la conversación.

#### Scenario: Ocultar durante la generación

- **WHEN** el usuario oculta el panel mientras SofLIA está escribiendo archivos
- **THEN** el panel desaparece, la generación continúa y el chat informa el avance

#### Scenario: Recuperar desde el menú de herramientas

- **WHEN** el usuario abre el menú de herramientas del encabezado del chat y elige la presentación
- **THEN** el panel vuelve a mostrarse con el proyecto activo y el progreso actualizado

#### Scenario: Menú sin presentación activa

- **WHEN** el usuario abre el menú de herramientas y no hay ninguna presentación en la conversación
- **THEN** la entrada de presentación no ofrece abrir un panel vacío y el menú conserva las demás superficies disponibles

### Requirement: Contenido no textual del proyecto

El panel SHALL mostrar las imágenes del proyecto como imágenes y MUST NOT leerlas como texto ni pintarlas carácter a carácter. Al abrir el proyecto, la selección inicial SHALL recaer en su documento, no en un recurso binario. El contenido de texto desproporcionado SHALL recortarse indicando cuánto se omitió.

#### Scenario: Imagen seleccionada

- **WHEN** el usuario selecciona una imagen del proyecto
- **THEN** el panel la muestra como imagen y no solicita su contenido como texto

#### Scenario: Selección inicial

- **WHEN** el panel abre un proyecto que contiene imágenes y documentos
- **THEN** selecciona el documento de entrada, no un recurso binario

### Requirement: Edición manual de los archivos del proyecto

El usuario SHALL poder editar y guardar desde el panel los archivos de texto que el proyecto le pertenecen. Los archivos que escribe el sistema MUST NOT ofrecerse para edición, y el guardado SHALL aplicar las mismas validaciones que una escritura del agente.

#### Scenario: Edición de un archivo propio

- **WHEN** el usuario edita el documento desde el panel y guarda
- **THEN** el cambio se escribe en el proyecto y el panel refleja el contenido guardado

#### Scenario: Archivo escrito por el sistema

- **WHEN** el usuario selecciona un archivo que escribe el sistema
- **THEN** el panel no ofrece editarlo

### Requirement: Recuperación del panel

El ancho del panel SHALL poder reducirse y ampliarse con el puntero. Cuando el usuario oculta el panel o vuelve a una conversación anterior que tiene un proyecto, SHALL poder volver a abrirlo; y una conversación sin proyecto MUST NOT ofrecer el de otra conversación.

#### Scenario: Ajuste de ancho

- **WHEN** el usuario arrastra el borde del panel
- **THEN** el ancho cambia en ambos sentidos dentro de sus límites y se recuerda

#### Scenario: Vuelta a una conversación con proyecto

- **WHEN** el usuario abre una conversación que ya generó una presentación
- **THEN** puede volver a abrir su panel desde el menú de herramientas

#### Scenario: Conversación sin proyecto

- **WHEN** el usuario abre una conversación que no tiene presentación
- **THEN** el menú no ofrece reabrir la de otra conversación
