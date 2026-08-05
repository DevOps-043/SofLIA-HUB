## ADDED Requirements

### Requirement: Workspace colaborativo de navegador
El sistema SHALL presentar el navegador integrado en todo el espacio no obstruido y SHALL mantener una única instancia compacta del chat activo como panel flotante movible mientras el modo navegador esté abierto.

#### Scenario: Apertura manual
- **WHEN** el usuario pulsa Navegador desde la Sidebar
- **THEN** la Sidebar de navegación se sustituye por el chat flotante compacto, el navegador ocupa el resto del workspace y no se pierde la conversación

#### Scenario: Apertura solicitada por el agente
- **WHEN** Computer Use solicita abrir el navegador mientras está cerrado
- **THEN** el sistema activa el mismo workspace colaborativo y espera un viewport visible antes de capturar

#### Scenario: Cierre y restauración
- **WHEN** el usuario cierra el panel del navegador
- **THEN** el sistema restaura la Sidebar, chats y carpetas en su estado anterior y conserva la página web

### Requirement: Chat flotante redimensionable y persistente
El sistema SHALL permitir ajustar el ancho del chat flotante dentro de límites utilizables, moverlo entre ambos lados, minimizarlo y restaurarlo, y SHALL conservar preferencias locales válidas.

#### Scenario: Ajuste intermedio
- **WHEN** el usuario arrastra el grip dentro de los límites
- **THEN** el chat cambia de ancho en tiempo real y el navegador recibe bounds visibles que excluyen únicamente el panel

#### Scenario: Expansión completa
- **WHEN** el usuario expande el navegador
- **THEN** el chat se colapsa y la vista web vuelve a ser interactiva sin recargar la página

#### Scenario: Mover o minimizar el panel
- **WHEN** el usuario mueve el chat al lado opuesto o lo minimiza
- **THEN** la conversación se conserva y el `WebContentsView` actualiza sus bounds sin composición periódica de PNG en el renderer, recarga ni nueva sesión

#### Scenario: Preferencia corrupta
- **WHEN** el ancho guardado no es numérico o queda fuera de la ventana actual
- **THEN** el sistema usa un valor predeterminado acotado sin desbordar la UI

### Requirement: Controles de panel perceptibles y accesibles
El sistema SHALL mostrar controles superiores reconocibles y un divisor visible con área de arrastre suficiente, feedback de foco/arrastre y operación por teclado.

#### Scenario: Arrastre del chat y navegador
- **WHEN** el usuario arrastra el grip del chat flotante
- **THEN** cambia el ancho del chat y los bounds de la vista web permanecen visibles e interactivos

#### Scenario: Control alternativo
- **WHEN** el usuario usa flechas sobre el grip o el control de expansión
- **THEN** ajusta el ancho por pasos o colapsa/restaura el chat sin depender de precisión del puntero

#### Scenario: Encabezado compacto
- **WHEN** el chat se muestra dentro del workspace del navegador
- **THEN** usa una barra propia con selector de modelo y razonamiento, mover y minimizar, omite Compartir y menús ajenos al contexto, y no produce desbordamiento horizontal

#### Scenario: Acceso compacto a conversaciones
- **WHEN** el usuario abre el menú de conversaciones del encabezado compacto
- **THEN** puede buscar y activar un chat existente o crear uno nuevo sin cerrar el navegador, restaurar la Sidebar ni perder la página visible

#### Scenario: Ocultar herramientas secundarias
- **WHEN** el usuario oculta la fila con título, historial, contraseñas y extensiones
- **THEN** el viewport gana altura, la preferencia queda guardada y un control persistente permite restaurarla

#### Scenario: Favoritos y extensiones en la fila secundaria
- **WHEN** la fila secundaria está visible
- **THEN** el usuario puede guardar, abrir y quitar favoritos locales, ve accesos a extensiones instaladas y conserva Historial, Contraseñas y Extensiones en la misma altura con overflow horizontal contenido

#### Scenario: Alineación con el contenido web
- **WHEN** el navegador calcula o modifica la altura de su barra superior
- **THEN** el panel flotante y su divisor comienzan debajo de esa barra, alineados con el viewport de la página y sin ocultar controles de navegación

### Requirement: Gestores flotantes alineados al sistema visual
El sistema SHALL presentar historial, contraseñas y extensiones como una superficie flotante redondeada sobre el contexto del navegador y MUST restaurar la misma página y sesión al cerrarla.

#### Scenario: Apertura de un gestor
- **WHEN** el usuario abre Historial, Contraseñas o Extensiones
- **THEN** el navegador conserva una captura temporal como fondo, la vista nativa se oculta y aparece un panel flotante sin perder página, cookies ni sesión

#### Scenario: Cierre accesible
- **WHEN** el usuario pulsa cerrar o Escape
- **THEN** el foco vuelve al control de origen y el `WebContentsView` recupera sus bounds y sesión sin recargar la página

### Requirement: Vista viva compatible con control del agente
El sistema SHALL mantener visible el `WebContentsView` en el área no obstruida mientras el chat flotante está abierto; la observación acotada ocurre en main y no reemplaza la vista interactiva por polling de PNG en el renderer.

#### Scenario: Agente actúa con el chat abierto
- **WHEN** SofLIA captura o interactúa con la página mientras el chat flotante está abierto
- **THEN** main opera sobre el mismo `webContents` visible, con coordenadas acordes a sus bounds actuales y sin crear otra sesión

#### Scenario: Fallo del navegador integrado
- **WHEN** la inicialización, captura o interacción de la vista integrada falla
- **THEN** la tarea devuelve un error controlado y no se reintenta sobre el escritorio ni el navegador predeterminado

### Requirement: Pestañas virtualizadas y composición de dos vistas
El sistema SHALL administrar hasta 500 pestañas lógicas en la misma sesión, MUST mantener un máximo de ocho vistas nativas vivas y SHALL permitir mostrar dos pestañas vivas en modo dividido o con una secundaria superpuesta.

#### Scenario: Crear y cerrar pestañas
- **WHEN** el usuario crea, activa o cierra una pestaña
- **THEN** cada pestaña conserva su navegación, la activa actualiza los controles y la cerrada libera su `WebContentsView` sin afectar las demás

#### Scenario: Ventana emergente permitida
- **WHEN** una página solicita abrir una URL HTTP(S) en otra ventana
- **THEN** main bloquea la ventana externa y abre la URL como pestaña interna en la misma sesión

#### Scenario: Dos pestañas simultáneas
- **WHEN** el usuario selecciona división o superposición con dos pestañas
- **THEN** ambas permanecen visibles e interactivas y el foco identifica cuál recibirá navegación, captura, credenciales y Computer Use

#### Scenario: Suspensión de pestañas inactivas
- **WHEN** una nueva pestaña supera el presupuesto de ocho vistas vivas
- **THEN** el sistema suspende la pestaña inactiva menos reciente, conserva metadata saneada y nunca suspende la activa ni las dos visibles

#### Scenario: Restaurar una pestaña suspendida
- **WHEN** el usuario activa una pestaña suspendida
- **THEN** el sistema recrea su vista con la misma partición persistente, restaura su última URL y vuelve a aplicar el presupuesto sin crear una sesión paralela

#### Scenario: Límite de pestañas
- **WHEN** ya existen 500 pestañas lógicas y se solicita otra
- **THEN** el sistema rechaza la operación con un error visible sin destruir ni reemplazar pestañas existentes

### Requirement: Ventanas de navegador separables y acotadas
El sistema SHALL permitir trasladar una pestaña a una ventana nativa independiente y reintegrarla sin recargar ni cambiar de sesión, MUST conservar el mismo objetivo para DOM, captura y Computer Use, y MUST aplicar el presupuesto global de vistas.

#### Scenario: Separar una pestaña
- **WHEN** el usuario separa una pestaña integrada
- **THEN** main mueve el mismo `WebContentsView` a una ventana nativa, conserva URL, cookies, historial en memoria y extensiones, y mantiene otra pestaña disponible en el workspace principal

#### Scenario: Reintegrar o cerrar la ventana
- **WHEN** el usuario pulsa Integrar o cierra la ventana separada
- **THEN** la vista vuelve al workspace principal sin recargar y la ventana contenedora se libera

#### Scenario: Agente sobre ventana separada
- **WHEN** el usuario enfoca una ventana separada y solicita leer o actuar sobre ella
- **THEN** esa pestaña se vuelve activa y el agente usa su mismo DOM, captura y `webContents`, sin abrir otro navegador o perfil

#### Scenario: Presupuesto global
- **WHEN** existen pestañas integradas y separadas simultáneamente
- **THEN** el sistema mantiene como máximo ocho vistas vivas, nunca suspende una pestaña separada y rechaza una quinta ventana separada con un error visible

### Requirement: Alternancia entre chat compacto y Orbe
El sistema SHALL permitir ocultar el chat lateral y abrir la Orbe general movible, y SHALL ofrecer una forma persistente de restaurar el chat sin cerrar el navegador.

#### Scenario: Activar Modo Orbe
- **WHEN** el usuario pulsa Modo Orbe desde el chat del navegador
- **THEN** se abre o enfoca la Orbe general con sus capacidades existentes, el chat se oculta sin desmontarse y la página recupera todo el ancho

#### Scenario: Restaurar chat
- **WHEN** el usuario pulsa Mostrar chat desde la barra del navegador
- **THEN** el panel reaparece debajo de la barra con la misma conversación, lado y ancho

#### Scenario: Compositor estrecho
- **WHEN** el panel está en su ancho mínimo
- **THEN** la barra y el compositor compactos conservan una sola línea inicial y el placeholder `Escribe a SofLIA...` se trunca sin recortarse verticalmente

### Requirement: Jerarquía visual y selector de razonamiento
El sistema SHALL aplicar al chat flotante, selector de modelos, gestores y confirmaciones la tipografía, radios, densidad y superficies de `SOFIA_DESIGN_SYSTEM.md` y SHALL presentar el razonamiento como un menú de opciones en filas, no como botones segmentados.

#### Scenario: Cambiar razonamiento
- **WHEN** el usuario abre el selector de modelo y elige un nivel compatible
- **THEN** ve nombre, descripción y marca de selección en una fila accesible, y la preferencia se actualiza sin cerrar ni reiniciar la conversación

#### Scenario: Compositor alineado
- **WHEN** el compositor está vacío o crece a varias líneas
- **THEN** el texto, placeholder y acciones conservan padding vertical simétrico, una altura inicial compacta y foco visible

### Requirement: Autenticación web compatible con la política de navegación
El sistema MUST bloquear protocolos no permitidos en el frame principal y MUST NOT presentar un fallo global por redirecciones secundarias de subframes que no cambian la página visible.

#### Scenario: OAuth o verificación en dos pasos
- **WHEN** un proveedor HTTP(S) completa una navegación principal permitida mientras subframes realizan redirecciones internas
- **THEN** la página continúa operativa y no conserva un aviso falso de redirección bloqueada

#### Scenario: Protocolo peligroso en el frame principal
- **WHEN** el frame principal intenta navegar a un protocolo fuera de la allowlist
- **THEN** main cancela la navegación, conserva la página previa y publica un error seguro

### Requirement: Continuidad acotada de automatizaciones web
El sistema SHALL asignar a las tareas del navegador integrado un presupuesto suficiente para flujos web multipaso, SHALL terminar anticipadamente al completar y MUST conservar un tope duro observable.

#### Scenario: Inicio de sesión y navegación multipaso
- **WHEN** el usuario solicita autenticar, atravesar redirecciones y llegar a una sección posterior dentro del navegador integrado
- **THEN** Computer Use recibe el presupuesto web acotado y continúa sobre la misma página y sesión hasta completar, cancelar, fallar o alcanzar el tope duro

#### Scenario: Presupuesto agotado
- **WHEN** la tarea alcanza el tope sin completar
- **THEN** el resultado indica que la página y sesión permanecen abiertas para continuar y no presenta el estado parcial como éxito

