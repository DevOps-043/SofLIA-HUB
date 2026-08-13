## Purpose

Permitir que el usuario sume al contexto del chat el contenido de las aplicaciones que ya tiene abiertas en su equipo, con selección explícita, la mayor fidelidad que cada aplicación permita y procedencia declarada en todo momento.

## ADDED Requirements

### Requirement: Inventario de aplicaciones sin lectura de contenido
El sistema SHALL ofrecer un inventario de las ventanas abiertas del equipo con nombre de ventana, aplicación de origen, identificador estable y miniatura. Construir el inventario MUST NOT leer el contenido de ninguna aplicación, invocar COM ni recorrer árboles de accesibilidad. El inventario MUST excluir las ventanas del propio Pulse Hub y las ventanas sin título.

#### Scenario: Apertura del selector
- **WHEN** el usuario abre "Añadir aplicaciones" en el menú de herramientas del chat
- **THEN** el selector lista las ventanas abiertas con su miniatura y aplicación de origen, sin extraer contenido de ninguna

#### Scenario: Exclusión de la propia aplicación
- **WHEN** el inventario se construye con Pulse Hub en primer plano
- **THEN** las ventanas de Pulse Hub no aparecen entre las candidatas

#### Scenario: Equipo sin ventanas candidatas
- **WHEN** no hay ninguna ventana con título distinta de Pulse Hub
- **THEN** el selector muestra un estado vacío explícito y no ofrece adjuntar nada

#### Scenario: Inventario no disponible
- **WHEN** la enumeración de ventanas falla o agota su presupuesto de tiempo
- **THEN** el selector muestra un error recuperable con reintento y no presenta una lista parcial como si fuera completa

### Requirement: Selección explícita como única vía de captura
El sistema SHALL extraer contenido de una aplicación únicamente después de que el usuario la marque en el selector. MUST NOT capturar, leer ni transmitir contenido de aplicaciones no marcadas, y MUST NOT mantener observación continua ni refrescar el contenido adjunto por iniciativa propia.

#### Scenario: Aplicación marcada y desmarcada
- **WHEN** el usuario marca una aplicación y la desmarca antes de enviar el turno
- **THEN** su contenido no se extrae ni se incluye en el turno

#### Scenario: Turno enviado
- **WHEN** el usuario envía el mensaje con aplicaciones marcadas
- **THEN** el contenido se extrae en ese momento y acompaña al turno como contexto, sin escribirse en el historial persistido

### Requirement: Extracción en cascada con degradación automática
El sistema SHALL intentar la extracción por niveles y usar el primero que entregue contenido útil: nivel A, ruta del documento abierto resuelta por COM y leída por el sidecar de documentos; nivel B, texto de la ventana obtenido del árbol de accesibilidad a partir de su identificador de ventana; nivel C, captura de la ventana para lectura por visión. Cada nivel SHALL tener un presupuesto de tiempo propio y, al agotarlo o fallar, SHALL degradar al siguiente sin abortar el turno.

El nivel B MUST partir del identificador de la ventana seleccionada y MUST NOT requerir traerla al primer plano ni alterar el foco del usuario.

El acceso COM del nivel A SHALL limitarse a consultar la ruta y el estado de guardado de los documentos abiertos, y MUST NOT modificar, guardar ni cerrar ningún documento.

#### Scenario: Documento de Office guardado
- **WHEN** el usuario marca una ventana de Word, Excel o PowerPoint cuyo documento está guardado en disco con una extensión soportada
- **THEN** el contenido se obtiene por nivel A y conserva las tablas del documento completo, no solo la parte visible

#### Scenario: Documento nunca guardado
- **WHEN** la ventana de Office corresponde a un documento sin ruta en disco
- **THEN** el sistema degrada al nivel siguiente y no adjunta un archivo distinto del que el usuario marcó

#### Scenario: Ruta que no corresponde a la ventana marcada
- **WHEN** COM devuelve un documento cuyo nombre de archivo no coincide con el título de la ventana seleccionada
- **THEN** el sistema descarta esa ruta y degrada al nivel siguiente

#### Scenario: Aplicación de terceros con accesibilidad
- **WHEN** el usuario marca una aplicación que no es de Office pero expone texto por accesibilidad
- **THEN** el contenido se obtiene por nivel B sin cambiar la ventana en primer plano

#### Scenario: Aplicación sin contenido legible
- **WHEN** ni COM ni el árbol de accesibilidad entregan texto
- **THEN** el sistema adjunta la captura de la ventana por nivel C

#### Scenario: Ventana cerrada durante la extracción
- **WHEN** el usuario cierra la aplicación entre la selección y el envío
- **THEN** ese adjunto falla de forma aislada con un aviso y el resto del turno se envía igualmente

### Requirement: Procedencia y fidelidad declaradas
El sistema SHALL declarar, en el chip visible para el usuario y en el bloque de contexto entregado al modelo, la aplicación de origen, el nivel de extracción usado y cualquier aviso aplicable. Cuando el nivel A use un archivo con cambios sin guardar, el sistema SHALL marcar el adjunto como desactualizado en ambas superficies. Cuando el contenido se trunque por límites, el bloque de contexto SHALL declararlo. El sistema MUST NOT presentar contenido de nivel C con la misma autoridad que el de nivel A.

#### Scenario: Cambios sin guardar
- **WHEN** el documento de Office tiene modificaciones sin guardar respecto al archivo en disco
- **THEN** el chip y el bloque de contexto advierten que el contenido puede estar desactualizado

#### Scenario: Contenido truncado
- **WHEN** el contenido extraído supera el límite por aplicación
- **THEN** se adjunta la parte permitida y el bloque de contexto declara el truncado

#### Scenario: Contenido obtenido por captura
- **WHEN** el adjunto se resolvió por nivel C
- **THEN** el chip indica que procede de una captura y el bloque de contexto acota la afirmación a lo visible en pantalla

### Requirement: Límites de volumen y tiempo
El sistema SHALL aplicar un límite de caracteres por aplicación y un límite agregado por turno, compartido con las pestañas del navegador adjuntas. SHALL acotar el tiempo total de extracción de un turno y degradar los adjuntos pendientes en lugar de bloquear el envío.

#### Scenario: Límite agregado alcanzado
- **WHEN** las aplicaciones y pestañas adjuntas juntas superan el límite del turno
- **THEN** el sistema recorta de forma determinista, informa qué se recortó y envía el turno

#### Scenario: Extracción lenta
- **WHEN** una aplicación agota el presupuesto de tiempo del turno
- **THEN** ese adjunto se degrada o se omite con aviso y el turno se envía sin esperar indefinidamente

### Requirement: Degradación explícita por plataforma
El sistema SHALL exponer la cascada completa en Windows. En macOS y Linux SHALL ofrecer al menos el inventario y el nivel C, y SHALL declarar en la respuesta del inventario qué niveles están disponibles para que la interfaz no ofrezca una fidelidad que la plataforma no puede entregar.

#### Scenario: Plataforma sin COM ni accesibilidad Windows
- **WHEN** el usuario ejecuta Pulse Hub fuera de Windows
- **THEN** el selector sigue listando ventanas y los adjuntos se resuelven por captura, indicándolo en el chip

### Requirement: Contrato IPC de cuatro capas
El sistema SHALL exponer las operaciones de inventario y de captura mediante canales dedicados con servicio en Electron main, handler, entrada en la allowlist del preload y wrapper tipado del renderer. Los errores devueltos al renderer MUST estar saneados y MUST NOT incluir rutas completas del sistema ni trazas internas.

#### Scenario: Canal invocado con entrada inválida
- **WHEN** el renderer solicita capturar un identificador de ventana inexistente o mal formado
- **THEN** el handler rechaza la solicitud con un error saneado y no ejecuta PowerShell ni COM

#### Scenario: Capacidad desactivada
- **WHEN** la bandera de configuración de la capacidad está desactivada
- **THEN** la opción no aparece en el menú de herramientas y los canales no quedan registrados
