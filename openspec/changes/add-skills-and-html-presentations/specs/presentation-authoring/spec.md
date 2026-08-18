## Purpose

Describe la Skill del sistema que convierte información del usuario en una presentación ejecutiva propia, escrita como archivos HTML y CSS reales con la identidad visual de su organización, editable por conversación y entregable en el chat y por WhatsApp sin depender de un generador externo.

## ADDED Requirements

### Requirement: Carpeta de proyecto por presentación

El sistema SHALL crear una carpeta de proyecto por cada presentación, bajo un directorio de presentaciones gestionado por la aplicación, y SHALL guardar allí los archivos generados junto con los recursos de marca descargados. La carpeta SHALL quedar asociada a la conversación que la originó para poder retomarla después.

#### Scenario: Creación de la carpeta

- **WHEN** el usuario pide una presentación y SofLIA inicia la generación
- **THEN** el sistema crea una carpeta de proyecto identificable, informa al usuario dónde quedó y escribe allí los archivos de la presentación

#### Scenario: Reanudación en una conversación existente

- **WHEN** el usuario vuelve a una conversación que ya generó una presentación
- **THEN** el sistema recupera la carpeta asociada y trabaja sobre esos archivos en lugar de crear un proyecto nuevo

#### Scenario: Acceso a la carpeta

- **WHEN** el usuario pide abrir la carpeta de la presentación
- **THEN** el sistema abre la ubicación en el explorador de archivos del sistema operativo

### Requirement: Generación de presentaciones en HTML y CSS

El sistema SHALL producir la presentación como archivos HTML y CSS navegables, con una diapositiva por sección y navegación entre diapositivas. El resultado SHALL abrirse correctamente sin conexión a internet y MUST NOT requerir recursos remotos para renderizar. La presentación SHALL incluir transición entre diapositivas y animación de entrada de su contenido, y SHALL reducirlas cuando el sistema del usuario declare preferencia por movimiento reducido. La presentación MAY incluir código de guion propio para enriquecer el diseño y el movimiento, siempre contenido en el propio proyecto.

#### Scenario: Movimiento que el estilo no alcanza

- **WHEN** un efecto de la presentación requiere lógica que la hoja de estilos no puede expresar
- **THEN** el sistema puede incluir código de guion dentro del proyecto, sin depender de librerías remotas, y la presentación sigue renderizando sin conexión

#### Scenario: Movimiento entre diapositivas

- **WHEN** el usuario avanza de una diapositiva a la siguiente
- **THEN** el cambio ocurre con una transición y el contenido de la nueva diapositiva aparece de forma escalonada, sin corte seco

#### Scenario: Preferencia de movimiento reducido

- **WHEN** el sistema del usuario declara preferencia por movimiento reducido
- **THEN** la presentación reduce sus transiciones y animaciones a un cambio prácticamente inmediato

#### Scenario: Presentación generada

- **WHEN** SofLIA termina de generar una presentación
- **THEN** la carpeta contiene al menos un documento HTML y su hoja de estilos, y el documento se renderiza completo sin solicitar recursos de red

#### Scenario: Navegación entre diapositivas

- **WHEN** el usuario reproduce la presentación y avanza
- **THEN** la vista cambia a la diapositiva siguiente y permite volver a la anterior

#### Scenario: Fallo durante la generación

- **WHEN** la generación se interrumpe por un error
- **THEN** el sistema conserva los archivos ya escritos, informa el error en lenguaje claro y no deja la conversación en un estado de generación permanente

### Requirement: Sentido del desplazamiento y entrada del contenido

La presentación SHALL avanzar por desplazamiento, sin controles de paginación dibujados, y el sistema SHALL poder elegir entre el avance vertical y el horizontal según el contenido. Sea cual sea el sentido elegido, el avance SHALL responder a los gestos habituales del usuario y las animaciones de entrada SHALL dispararse al aparecer cada diapositiva. El contenido de cada diapositiva SHALL entrar de forma escalonada, no de golpe.

#### Scenario: Avance horizontal

- **WHEN** el sistema elige el avance horizontal para la presentación
- **THEN** la baraja avanza con la rueda y el trackpad igual que la vertical, y las animaciones de entrada se disparan al aparecer cada diapositiva

#### Scenario: Entrada del contenido

- **WHEN** una diapositiva entra en pantalla
- **THEN** sus elementos aparecen escalonados en el orden de lectura, no todos a la vez

#### Scenario: Sin controles dibujados

- **WHEN** el usuario recorre la presentación
- **THEN** no hay flechas, puntos de paginación ni contadores dibujados por el sistema para avanzar

### Requirement: Reanudación de una conversación con entregable

Cuando una conversación ya tiene un entregable de una Skill con espacio de trabajo, el sistema SHALL disponer de sus herramientas de archivo al pedirle un cambio, sin exigir que el usuario vuelva a invocar la Skill. El sistema MUST NOT responder que carece de acceso a los archivos mientras el entregable exista, y MUST NOT regenerar el proyecto desde cero ni volver a preguntar por el tema y las fuentes.

#### Scenario: Cambio pedido en un turno posterior

- **WHEN** el usuario pide una modificación sobre una presentación ya generada en esa conversación
- **THEN** el sistema aplica el cambio sobre los archivos existentes, sin declarar que no tiene acceso al espacio de trabajo

#### Scenario: Skill retirada del compositor

- **WHEN** el usuario retira la Skill del compositor mientras la conversación conserva su presentación
- **THEN** el sistema no vuelve a imponer la Skill en el compositor, y las herramientas de archivo siguen disponibles mientras el entregable exista

#### Scenario: Estado de la interfaz perdido

- **WHEN** la interfaz pierde el estado de la Skill por cualquier motivo y la conversación conserva su presentación
- **THEN** el turno recupera sus herramientas de archivo a partir del entregable, sin depender de ese estado

### Requirement: Animaciones perceptibles

Las animaciones de entrada SHALL ser perceptibles al llegar cada diapositiva, incluso cuando el avance ocurre por saltos, y SHALL escalonarse en el orden de lectura. Si el mecanismo que las dispara no está disponible, el contenido SHALL quedar visible y estático; MUST NOT quedar oculto.

#### Scenario: Avance por saltos

- **WHEN** el usuario avanza a la diapositiva siguiente
- **THEN** su contenido entra de forma escalonada y visible, no aparece ya colocado

#### Scenario: Sin el mecanismo de animación

- **WHEN** el mecanismo que dispara las animaciones no llega a ejecutarse
- **THEN** la presentación se ve completa y estática, sin contenido invisible

### Requirement: Composición legible y contenida

Ningún elemento de una diapositiva SHALL superponerse a otro, y el contenido que no cabe MUST NOT recortarse en silencio ni desplazarse fuera de la pantalla. Los diagramas SHALL disponer de piezas del sistema que resuelvan su reparto, en lugar de colocarse por coordenadas.

#### Scenario: Diapositiva con más contenido del que cabe

- **WHEN** una diapositiva contiene más elementos de los que caben en la pantalla
- **THEN** el contenido empieza desde el borde superior y sigue siendo alcanzable, sin quedar recortado ni encimado con el pie

#### Scenario: Diagrama de proceso

- **WHEN** la presentación necesita representar un flujo, un proceso o un conjunto de elementos alrededor de un centro
- **THEN** el sistema lo compone con las piezas provistas, que se reparten solas y caben en la diapositiva

### Requirement: Continuidad del turno de generación

Construir la presentación SHALL disponer del margen de trabajo que exige entregar varios archivos, y el sistema MUST NOT reenviar al proveedor el contenido de los archivos que ya escribió. El resultado de una herramienta MUST NOT incorporar datos binarios ni volcados desproporcionados al contexto del modelo: una imagen devuelta por una herramienta SHALL entregarse como imagen y no como texto, y lo que se omita SHALL quedar señalado en el propio resultado. Ante un error transitorio del proveedor el sistema SHALL reintentar antes de rendirse, y cuando finalmente informe un fallo el mensaje SHALL corresponder a la causa real.

#### Scenario: Herramienta que devuelve una captura

- **WHEN** una herramienta del turno devuelve una imagen de la pantalla
- **THEN** la imagen se adjunta como imagen, el texto del resultado indica que existe, y su contenido binario no entra en el contexto como texto

#### Scenario: Resultado desproporcionado

- **WHEN** el resultado de una herramienta no cabe en el presupuesto del contexto
- **THEN** el sistema conserva los campos que sostienen la decisión, descarta los más pesados y deja constancia de lo omitido

#### Scenario: Petición demasiado grande

- **WHEN** el proveedor rechaza la petición por tamaño
- **THEN** el sistema no la reintenta con el mismo contenido y explica que hay que reducir el trabajo, no que espere

#### Scenario: Límite transitorio del proveedor

- **WHEN** el proveedor rechaza una petición por un límite transitorio de capacidad
- **THEN** el sistema reintenta y continúa la generación en lugar de terminar el turno con la presentación a medias

#### Scenario: Turno de varios archivos

- **WHEN** la generación necesita escribir el documento, sus estilos, sus notas y sus imágenes
- **THEN** el turno dispone de margen suficiente para completarlos y no responde como terminado sobre una carpeta incompleta

#### Scenario: Turno que ya no cabe

- **WHEN** el turno supera lo que el proveedor admite en una sola conversación
- **THEN** el sistema lo explica como tal y orienta a acortar el trabajo, en lugar de presentarlo como una falta temporal de capacidad

### Requirement: Identidad visual de la organización

La presentación SHALL aplicar los colores de marca, la tipografía, el logo y el banner de la organización del usuario cuando la organización tiene branding habilitado. Cuando no lo tiene o los datos no están disponibles, el sistema SHALL usar un tema neutro y SHALL indicarlo al usuario en lugar de inventar una identidad.

#### Scenario: Organización con branding habilitado

- **WHEN** el usuario pertenece a una organización con branding habilitado y pide una presentación
- **THEN** la presentación usa los colores, la tipografía y el logo de esa organización

#### Scenario: Organización sin branding

- **WHEN** la organización del usuario no tiene branding habilitado
- **THEN** la presentación usa el tema neutro del producto y SofLIA menciona que no aplicó identidad corporativa

#### Scenario: Paleta derivada del logotipo

- **WHEN** la organización tiene logo y no ha configurado colores de marca propios
- **THEN** el sistema deriva la paleta del propio logotipo y la aplica a la presentación

#### Scenario: Colores configurados por la organización

- **WHEN** la organización sí configuró sus colores de marca
- **THEN** el sistema respeta esos colores y no los sustituye por los del logotipo

#### Scenario: Color de marca ilegible sobre el fondo

- **WHEN** un color derivado del logotipo no alcanza contraste suficiente sobre el fondo de la presentación
- **THEN** el sistema lo ajusta conservando su tono hasta que el texto sea legible

#### Scenario: Logotipo sin color aprovechable

- **WHEN** el logotipo es monocromo o su formato no puede analizarse
- **THEN** el sistema conserva los colores declarados o el tema neutro, sin inventar una paleta

#### Scenario: Recurso de marca no descargable

- **WHEN** un recurso de marca no se puede descargar
- **THEN** la presentación se genera igual, omite ese recurso, conserva los colores disponibles y el sistema registra el recurso faltante sin bloquear la entrega

### Requirement: Recolección y confirmación antes de generar

Al activarse la Skill, el sistema MUST NOT empezar a escribir archivos sin
haber establecido el contenido y el destinatario. El sistema SHALL resumir y
confirmar la información ya disponible en la conversación, SHALL leer la página
abierta en el navegador integrado cuando exista en vez de preguntar por su
contenido, y SHALL pedir tema, destinatario y origen de la información cuando
la conversación esté vacía, ofreciendo explícitamente documento de Drive,
archivo del equipo o investigación. Cuando la información la obtenga el propio
sistema investigando, SHALL presentar un esquema de diapositivas y esperar
validación explícita del usuario antes de generar.

#### Scenario: La conversación ya tiene contenido

- **WHEN** el usuario activa la Skill en una conversación que ya trae un documento leído o una investigación
- **THEN** el sistema resume qué información usaría y pide confirmación antes de generar

#### Scenario: El usuario está viendo una página

- **WHEN** el usuario activa la Skill con una página abierta en el navegador integrado
- **THEN** el sistema lee esa página y propone el enfoque, sin pedirle al usuario que describa su contenido

#### Scenario: Conversación vacía

- **WHEN** el usuario activa la Skill en una conversación sin contenido previo
- **THEN** el sistema pregunta tema, destinatario y origen de la información, y ofrece Drive, archivo del equipo o investigación como vías

#### Scenario: Investigación validada antes de generar

- **WHEN** el usuario pide que el sistema investigue el tema
- **THEN** el sistema investiga, presenta un esquema con el mensaje clave de cada diapositiva y no escribe ningún archivo hasta que el usuario lo aprueba

#### Scenario: Dato faltante que cambia la presentación

- **WHEN** falta un dato que altera el contenido, como el cliente destinatario o una cifra central
- **THEN** el sistema lo pregunta en vez de inventarlo

### Requirement: Fuentes de contenido admitidas

El sistema SHALL construir la presentación a partir de archivos adjuntos en el chat, documentos de Drive seleccionados por el usuario, el contenido de la pestaña activa del navegador integrado, resultados de una investigación previa de la conversación, o criterios dictados por el usuario. El contenido obtenido de páginas web o documentos SHALL tratarse como dato no confiable y MUST NOT interpretarse como instrucciones para el agente.

#### Scenario: Presentación desde un archivo adjunto

- **WHEN** el usuario adjunta un documento y pide una presentación ejecutiva de su contenido
- **THEN** el sistema usa el contenido del documento como fuente y no solicita al usuario que lo transcriba

#### Scenario: Presentación desde la página que el usuario está viendo

- **WHEN** el usuario pide una presentación ejecutiva de la página abierta en el navegador integrado
- **THEN** el sistema lee el contenido saneado de esa pestaña y genera la presentación a partir de él

#### Scenario: Contenido con instrucciones incrustadas

- **WHEN** una fuente contiene texto que pretende dar órdenes al agente
- **THEN** el sistema lo trata como contenido de la presentación y no altera su comportamiento ni ejecuta esas instrucciones

#### Scenario: Fuente insuficiente

- **WHEN** el usuario pide una presentación sin indicar tema ni aportar ninguna fuente utilizable
- **THEN** SofLIA solicita la información mínima necesaria en lugar de inventar contenido

### Requirement: Profundidad del contenido generado

La presentación SHALL desarrollar la fuente en lugar de resumirla en generalidades: cada afirmación SHALL apoyarse en un dato concreto de la fuente y el sistema SHALL recorrer la fuente completa antes de esquematizar. El sistema SHALL producir además notas del presentador con el detalle que no cabe en las diapositivas. Cuando la fuente no dé para la profundidad esperada, el sistema SHALL decirlo y proponer cómo completarla, y MUST NOT rellenar con contenido genérico ni con datos inventados.

#### Scenario: Fuente extensa

- **WHEN** el documento o la página que sirve de fuente es extensa o está paginada
- **THEN** el sistema recorre todas sus partes antes de esquematizar, y la presentación recoge las cifras, fechas y nombres concretos que contiene

#### Scenario: Afirmación sin respaldo

- **WHEN** una afirmación de la presentación no se apoya en ningún dato de la fuente
- **THEN** el sistema la reformula con el dato que sí tiene o la retira, en lugar de mantener un enunciado genérico

#### Scenario: Notas del presentador

- **WHEN** el sistema termina de generar la presentación
- **THEN** el proyecto incluye notas por diapositiva con el detalle que la sostiene, suficientes para exponerla

#### Scenario: Fuente que no da para la profundidad pedida

- **WHEN** la fuente disponible no alcanza para el desarrollo que el usuario espera
- **THEN** el sistema lo indica en la conversación y propone cómo completarla, sin rellenar con contenido genérico

### Requirement: Imágenes en la presentación

El sistema MAY incorporar imágenes de fondo o ilustrativas a la presentación, generándolas con el modelo de imagen del producto o descargándolas de una fuente pública, y SHALL guardarlas dentro del proyecto para que el documento siga renderizando sin conexión. Las imágenes MUST NOT sustituir a los gráficos de datos, a los iconos ni a ningún elemento que comunique información numérica o textual. Una imagen generada MUST NOT presentarse como representación de un hecho, una persona o un lugar reales.

#### Scenario: Fondo de portada

- **WHEN** la presentación necesita un fondo para su portada o para una apertura de sección
- **THEN** el sistema incorpora la imagen al proyecto, la referencia por ruta relativa y conserva el contraste del texto sobre ella

#### Scenario: Imagen de la fuente

- **WHEN** la fuente que se está presentando contiene una imagen pertinente
- **THEN** el sistema puede descargarla al proyecto y usarla, en lugar de enlazarla desde internet

#### Scenario: La fuente observada trae material gráfico

- **WHEN** el sistema observa la página o el documento que sirve de fuente
- **THEN** la observación le entrega las imágenes de contenido de esa fuente, y el sistema las prefiere sobre generar unas nuevas

#### Scenario: Dato que pide un gráfico

- **WHEN** la diapositiva debe comunicar cifras o una comparación
- **THEN** el sistema dibuja un gráfico vectorial con los datos reales y no genera una imagen que los represente

### Requirement: Importación verificable de visuales de la fuente

Cuando la Skill de presentaciones recibe imágenes adjuntas o observa imágenes
de contenido en la página o documento fuente, el sistema SHALL intentar
materializarlas dentro de `assets/` antes de solicitar el deck al modelo. El
sistema SHALL entregar al modelo las rutas locales importadas mediante un
manifiesto tratado como dato no confiable, SHALL preferir esos recursos cuando
sostengan la narrativa y SHALL usar la generación de imágenes solo como
complemento. Un fallo individual MUST NOT descartar los recursos ya importados
ni el contenido textual de la fuente.

#### Scenario: Página con fotografías y diagramas

- **WHEN** la observación de la página fuente contiene imágenes de contenido pertinentes
- **THEN** el sistema descarga una selección acotada al workspace y el modelo recibe sus rutas locales antes de escribir `deck.json`

#### Scenario: Documento con material gráfico visible

- **WHEN** el sistema lee de forma estructurada un documento abierto y puede capturar su vista actual
- **THEN** entrega tanto el texto y tablas del documento completo como su visual de apoyo, sin degradar la procedencia del contenido

#### Scenario: Recurso de fuente bloqueado

- **WHEN** una de las imágenes observadas no se puede descargar o validar
- **THEN** el sistema conserva las demás imágenes importadas, mantiene el contenido de la fuente y registra el recurso fallido en el manifiesto

#### Scenario: Evidencia disponible y generación complementaria

- **WHEN** una imagen o gráfica documental pertinente ya fue importada desde la fuente
- **THEN** el modelo la reutiliza y no pide una recreación generada; solo genera visuales para conceptos sin representación de fuente

### Requirement: Iteración conversacional sobre la presentación

El usuario SHALL poder pedir modificaciones en lenguaje natural sobre una presentación existente. El sistema SHALL editar los archivos de esa presentación conservando el resto del contenido, y MUST NOT regenerar el proyecto completo cuando el cambio es acotado.

#### Scenario: Cambio acotado

- **WHEN** el usuario pide cambiar el texto de una diapositiva concreta
- **THEN** el sistema modifica solo esa parte, conserva las demás diapositivas y la vista previa refleja el cambio

#### Scenario: Cambio de estilo global

- **WHEN** el usuario pide cambiar un aspecto visual que afecta toda la presentación
- **THEN** el sistema modifica la hoja de estilos y todas las diapositivas reflejan el cambio sin perder su contenido

#### Scenario: Petición ambigua

- **WHEN** el usuario pide un cambio que puede aplicarse a varias diapositivas y no queda claro a cuál se refiere
- **THEN** SofLIA pregunta antes de modificar los archivos

### Requirement: Exportación y entrega

El sistema SHALL permitir exportar la presentación a un único archivo HTML autocontenido, con los estilos incrustados y las imágenes embebidas, que se abra en cualquier navegador sin conexión y conserve las transiciones y animaciones. El sistema MUST NOT exportar la presentación a un formato estático que elimine el movimiento. La entrega de la presentación por un canal externo SHALL requerir una acción o confirmación explícita del usuario.

#### Scenario: Exportación a un archivo

- **WHEN** el usuario pide exportar la presentación
- **THEN** el sistema genera un archivo HTML autocontenido en la carpeta del proyecto e informa su ubicación

#### Scenario: El archivo exportado no depende de la red

- **WHEN** el usuario abre el archivo exportado en otro equipo sin conexión
- **THEN** la presentación se ve completa, con sus estilos, imágenes y animaciones

#### Scenario: Recurso fuera del proyecto referenciado en el documento

- **WHEN** el documento referencia un archivo fuera de la carpeta del proyecto
- **THEN** el sistema no lo incrusta en el archivo exportado

#### Scenario: Envío por un canal externo

- **WHEN** SofLIA propone enviar la presentación por un canal externo
- **THEN** el envío solo ocurre tras la confirmación explícita del usuario

### Requirement: Presentaciones por WhatsApp sin generador externo

El flujo de presentaciones de WhatsApp SHALL usar el motor propio de HTML y CSS y SHALL entregar el archivo generado por el mismo canal. El sistema MUST NOT enviar el contenido de la presentación a un generador de presentaciones de terceros ni devolver un enlace a una presentación alojada por terceros.

#### Scenario: Presentación solicitada por WhatsApp

- **WHEN** el usuario inicia el flujo de presentaciones por WhatsApp y aprueba la propuesta
- **THEN** SofLIA genera la presentación con el motor propio y entrega el archivo HTML autocontenido por WhatsApp, indicando que se abre con el navegador

#### Scenario: Sin dependencia de terceros

- **WHEN** se completa cualquier presentación en cualquier superficie
- **THEN** el sistema no realiza ninguna llamada a un servicio externo de generación de presentaciones

#### Scenario: Cancelación del flujo

- **WHEN** el usuario cancela el flujo de presentaciones por WhatsApp
- **THEN** el sistema termina el flujo, deja de esperar respuestas y no entrega ningún archivo

## REMOVED Requirements

### Requirement: Generación de presentaciones mediante Gamma

**Reason**: Enviaba el contenido del usuario a un tercero, devolvía un enlace externo no editable y no permitía aplicar la identidad visual de la organización ni mostrar el proceso de creación.

**Migration**: El flujo `/presentacion` de WhatsApp pasa a usar el motor propio de HTML y CSS y entrega el archivo generado en lugar de un enlace. La credencial de Gamma deja de leerse y se retira de la configuración; las presentaciones creadas antes del cambio siguen accesibles en su enlace original, fuera del producto.

### Requirement: Coherencia de la serie ilustrada

Cuando la presentación incorpore ilustraciones generadas, todas SHALL compartir una misma dirección de arte declarada por el sistema, de modo que se lean como una serie y no como imágenes sueltas. Esa dirección SHALL viajar como dato explícito de cada generación, y MUST NOT quedar sujeta a que el generador la recuerde. Una generación dirigida MUST NOT recibir criterios estéticos generales que contradigan esa dirección.

#### Scenario: Segunda ilustración de la baraja

- **WHEN** el sistema genera una ilustración adicional para la misma presentación
- **THEN** aplica la misma dirección de arte que la primera, y el resultado pertenece visiblemente a la misma serie

#### Scenario: Dirección de arte declarada

- **WHEN** la generación indica una dirección de arte propia
- **THEN** el sistema la respeta y no le superpone criterios estéticos generales, conservando las reglas de seguridad

#### Scenario: Rótulos y cifras

- **WHEN** una ilustración necesita etiquetas, cifras o títulos
- **THEN** el sistema los compone fuera de la imagen, donde son legibles y animables, y no se los pide al generador

### Requirement: Ediciones que no se repiten a ciegas

Cuando una edición por reemplazo exacto no se pueda aplicar, el sistema SHALL explicar la causa con evidencia del contenido real del archivo, de modo que el siguiente intento pueda corregirse en lugar de adivinar. Tras fallos consecutivos sobre el mismo archivo, el sistema SHALL releerlo antes de volver a intentarlo, y MUST NOT repetir indefinidamente la misma edición.

#### Scenario: Fragmento con otro formato

- **WHEN** el fragmento existe en el archivo pero con espacios o saltos de línea distintos
- **THEN** el error lo indica como tal, en lugar de afirmar que el fragmento no existe

#### Scenario: Fragmento que no coincide

- **WHEN** el fragmento no coincide con el contenido del archivo
- **THEN** el error incluye el contenido real de esa zona, con sus líneas, para poder copiarlo

#### Scenario: Fragmento ambiguo

- **WHEN** el fragmento aparece varias veces
- **THEN** el error indica en qué líneas aparece, para poder ampliar el contexto

### Requirement: El contenido siempre cabe en la diapositiva

Ninguna diapositiva SHALL mostrar su contenido cortado ni fuera del área visible, en cualquiera de los sentidos de avance. Cuando el contenido exceda el espacio disponible, el sistema SHALL reducirlo hasta que quepa, sin encoger el fondo ni los elementos de ambiente, y SHALL rehacer el ajuste cuando cambie el tamaño de la ventana.

#### Scenario: Diapositiva con exceso de contenido en avance horizontal

- **WHEN** una diapositiva de una baraja horizontal contiene más de lo que cabe en la pantalla
- **THEN** su contenido se reduce hasta caber, y ni el título ni el pie quedan cortados

#### Scenario: Cambio de tamaño de la ventana

- **WHEN** el usuario cambia el tamaño de la ventana durante la presentación
- **THEN** el sistema recalcula el ajuste y el contenido sigue cabiendo

#### Scenario: Movimiento reducido con contenido denso

- **WHEN** el sistema operativo solicita movimiento reducido y una diapositiva excede el alto visible
- **THEN** el sistema omite las animaciones, conserva todo el contenido visible en su estado final y ejecuta igualmente el ajuste de maquetacion

#### Scenario: Ajuste sin espacio fantasma

- **WHEN** el sistema reduce una diapositiva para que quepa
- **THEN** reduce tambien la caja que participa en la maquetacion, no deja un hueco invisible con la altura anterior y conserva el mayor tamano que cabe

### Requirement: Narrativa y composicion editorial verificables

La Skill SHALL definir antes del HTML el trabajo de comunicacion, la audiencia, la conclusion central y un arco acumulativo. Cada diapositiva SHALL tener un mensaje principal, un titular de conclusion y evidencia concreta o una inferencia identificada. La composicion SHALL privilegiar una pieza visual dominante y MUST NOT degradar por defecto a una rejilla repetida de tarjetas o paneles de interfaz.

#### Scenario: Esquema previo con evidencia

- **WHEN** el sistema propone el esquema de una presentacion
- **THEN** cada diapositiva declara su mensaje clave y el dato, caso o fuente que lo sostiene

#### Scenario: Fuente insuficiente

- **WHEN** la fuente no respalda una afirmacion o la profundidad solicitada
- **THEN** el sistema la retira, la marca como hipotesis o solicita material adicional, y no la rellena con contenido generico

#### Scenario: Variedad visual

- **WHEN** el sistema compone dos diapositivas consecutivas
- **THEN** evita repetir el mismo arquetipo y usa tarjetas solo cuando la informacion forma una serie real

### Requirement: Auditoria local de calidad de la baraja

El guion base SHALL publicar un informe local y determinista de calidad visual sin red ni permisos adicionales. El informe SHALL detectar como minimo contenido fuera del lienzo, imagenes rotas, titulares de mas de tres lineas, factores de ajuste inferiores a 0.82 y una diapositiva activa sin contenido visible. La Skill MUST NOT declarar terminada una baraja con incidencias observadas sin recomponerla o dividirla.

#### Scenario: Presentacion correcta

- **WHEN** todas las diapositivas caben, sus recursos cargan y su contenido activo es visible
- **THEN** `window.__PULSE_DECK_REPORT__` indica exito y `data-pulse-calidad` vale `ok`

#### Scenario: Recurso roto o contenido recortado

- **WHEN** una imagen no carga o una caja sale del lienzo visible
- **THEN** el informe identifica la diapositiva y el codigo de incidencia correspondiente

#### Scenario: Verificacion responsive y accesible

- **WHEN** se verifica la baraja antes de entregarla
- **THEN** se comprueba en lienzo 16:9, ventana angosta y movimiento reducido, y no se afirma un resultado que no se haya observado

### Requirement: Actualizacion compatible del motor de la baraja

Los archivos protegidos de diseno y movimiento SHALL actualizarse a la version de la aplicacion antes de previsualizar, presentar o exportar una baraja persistente. La actualizacion MUST ser atomica e idempotente, MUST NOT reescribir archivos editables del usuario y MUST NOT provocar un ciclo de recarga del panel.

#### Scenario: Baraja antigua con ajuste por zoom

- **WHEN** el usuario vuelve a abrir una presentacion cuyo `guion-base.js` pertenece a una version anterior
- **THEN** el sistema sustituye el guion y la hoja base protegidos antes de renderizar, y conserva `index.html`, `presentacion.css`, recursos y marca

#### Scenario: Motor ya actualizado

- **WHEN** el contenido protegido coincide con la version vigente
- **THEN** el sistema no toca el disco ni emite un progreso que recargue la vista previa

### Requirement: Coreografia editorial determinista

El movimiento de entrada SHALL ser propiedad del guion base y SHALL derivarse del rol semantico del elemento, con secuencia, curva y duracion coherentes entre presentaciones. El HTML de una baraja MAY anotar excepciones con `data-movimiento`, pero MUST NOT depender de una libreria remota ni duplicar la coreografia general. Si WAAPI no esta disponible o se solicita movimiento reducido, el contenido SHALL conservar un estado final visible.

#### Scenario: Navegador con Web Animations API

- **WHEN** una diapositiva se activa
- **THEN** antetitulo, titular, texto, visuales y piezas entran en una secuencia editorial segun su rol, sin dos animaciones compitiendo por el mismo `transform`

#### Scenario: Navegador sin WAAPI o con movimiento reducido

- **WHEN** la API nativa no existe o el usuario solicita menos movimiento
- **THEN** el sistema usa la degradacion CSS o muestra el estado final, sin ocultar contenido ni desactivar el ajuste de maquetacion

### Requirement: Autoría declarativa y render React

El sistema SHALL generar las presentaciones nuevas como un `deck.json`
validado y SHALL reservar el HTML, CSS, componentes React y líneas de tiempo al
runtime de la aplicación. El contrato MUST limitar densidad, arquetipos, rutas
de recursos y vocabulario de movimiento. La vista SHALL usar un lienzo lógico
1920×1080 escalado uniformemente y MUST NOT recomponer columnas por el tamaño
del panel.

#### Scenario: Deck válido

- **WHEN** el agente completa un `deck.json` que satisface el esquema
- **THEN** el runtime React lo reproduce con identidad de marca y movimiento semántico sin ejecutar código escrito por el modelo

#### Scenario: Deck inválido

- **WHEN** el contrato contiene un tipo desconocido, exceso de densidad, ids repetidos o una ruta fuera de `assets/`
- **THEN** el sistema rechaza la presentación antes de abrirla y explica los campos que deben corregirse

#### Scenario: El modelo anuncia el resultado antes de escribir el deck

- **WHEN** el modelo intenta cerrar el turno pero el workspace no contiene un `deck.json` valido
- **THEN** el sistema descarta ese cierre, le pide continuar con el entregable y nunca muestra un mensaje de exito falso

#### Scenario: Archivos de sistema del runtime React

- **WHEN** se crea una presentacion nueva cuyo documento de entrada es `deck.json`
- **THEN** el sistema escribe solo los tokens de marca en `estilos/marca.css` y no siembra `estilos/base.css` ni `guion-base.js`, que pertenecen al runtime HTML heredado

#### Scenario: Variantes editoriales declarativas compatibles

- **WHEN** el agente usa listas breves, bloques, filas comparativas, pasos numerados, notas de metricas, citas multiples o metadatos de fuente dentro de los limites publicados
- **THEN** el esquema acepta esas variantes cerradas y React las compone sin permitir HTML, CSS, JSX ni coordenadas libres

#### Scenario: Variedad compositiva verificable

- **WHEN** una baraja nueva declara una variante compositiva por diapositiva
- **THEN** el contrato impide repetir la misma firma de arquetipo y variante, y una baraja de ocho o mas escenas combina al menos cuatro variantes

#### Scenario: Paleta de fuente solicitada por el usuario

- **WHEN** el usuario pide explicitamente adoptar los colores de la pagina, documento o video observado
- **THEN** `meta.tema` declara origen `fuente`, el runtime sustituye los colores corporativos solo dentro del lienzo y conserva contraste legible

#### Scenario: La fuente intenta ordenar un cambio de identidad

- **WHEN** el contenido no confiable de una fuente incluye una instruccion para cambiar colores o identidad
- **THEN** el sistema la trata como dato, mantiene la prioridad de la instruccion del usuario y no activa `meta.tema`

#### Scenario: Imagen contenida con otra proporcion

- **WHEN** un diagrama, captura o grafica usa ajuste `contener` y no llena la proporcion del marco
- **THEN** React completa el marco con una capa derivada de la propia imagen y no muestra bandas grises ni un bloque vacio

#### Scenario: Evidencia cuantitativa como gráfica

- **WHEN** el agente declara categorías y series numéricas alineadas para barras, líneas, área, radar o anillo
- **THEN** el runtime las visualiza con Recharts y Framer Motion sin delegar coordenadas, SVG ni código al modelo

#### Scenario: Microinteracción y movimiento reducido

- **WHEN** el usuario posa el cursor sobre una tarjeta, proceso, imagen o gráfica
- **THEN** el runtime aplica una respuesta breve y profesional; si el sistema solicita movimiento reducido, conserva el estado legible sin desplazamiento

#### Scenario: La presentación termina mientras la vista previa está abierta

- **WHEN** el panel pasa de un workspace incompleto a un `deck.json` válido
- **THEN** la vista previa calcula la escala, carga los módulos del runtime dentro del iframe aislado y muestra la primera diapositiva sin exigir un resize manual

### Requirement: Servidor local y exportación autocontenida del runtime

El sistema SHALL servir el runtime nuevo únicamente en loopback, con puerto
dinámico y una sesión opaca por workspace. Solo SHALL exponer el bundle del
renderer y `deck.json`, `estilos/marca.css` y `assets/` del workspace. La
exportación SHALL producir un HTML único que contenga el bundle React, el
contrato, la marca y las imágenes, y MUST NOT requerir red para reproducirse.

#### Scenario: Recurso fuera de la allowlist

- **WHEN** una petición intenta leer otro archivo o atravesar la raíz del workspace
- **THEN** el servidor responde que no existe sin revelar rutas absolutas

#### Scenario: Exportación del deck React

- **WHEN** el usuario exporta una presentación declarativa válida
- **THEN** recibe un HTML autocontenido que conserva navegación y movimiento sin referencias externas
