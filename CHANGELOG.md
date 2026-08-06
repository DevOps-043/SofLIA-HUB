# Changelog

Todos los cambios notables de SofLIA Hub se documentan aqui.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [0.9.2] - 2026-08-05

### Fixed

- **Respuestas del chat recortadas dentro del navegador:** El mensaje del modelo era un item flex sin `min-w-0`, asi que su tamano minimo automatico lo calculaba el contenido (tablas, bloques de codigo, URLs largas). El item crecia por encima de su `max-width` y el contenedor superior lo recortaba, de modo que en el panel flotante las tablas quedaban cortadas contra el borde. Ahora la cadena de contenedores esta acotada, las celdas parten palabras y solo si aun no cabe la tabla desplaza en horizontal dentro de su propio contenedor.
- **Parpadeo al abrir la barra de direcciones, navegar o cerrar un gestor:** La vista nativa se sustituye por un respaldo visual mientras se superpone la interfaz del navegador, pero el intercambio ocurria en el mismo turno: se ocultaba la capa nativa antes de que el respaldo estuviera pintado y se retiraba el respaldo antes de que la vista volviera a componer. El area quedaba en blanco uno o dos cuadros y se percibia como un refresco de toda la pagina. El intercambio ahora esta sincronizado con el cuadro pintado en ambos sentidos, con salvaguarda de tiempo si el compositor no entrega cuadros.
- **Paginas lentas en cargar paneles y listas:** Cada publicacion de viewport ocultaba todas las vistas y volvia a mostrar la activa, y reenviaba los mismos bounds. La pagina descartaba su cuadro compuesto y reiniciaba la carga diferida en cada redimension o cambio del panel de chat, que es lo que hacia que la transcripcion de YouTube o las listas de Gmail tardaran en aparecer. El layout ahora solo aplica los cambios reales de bounds y visibilidad. Ademas, las vistas del navegador dejan de aplicar `backgroundThrottling`: quedaban ocultas cada vez que se abria un gestor o las sugerencias y esa pausa congelaba temporizadores y peticiones en curso.
- **SofLIA no podia abrir elementos de la pagina que ya estaba leyendo:** El agente del navegador solo tenia lectura de DOM y navegacion por URL. Ante "resume los ultimos correos y abrelos" leia la bandeja pero respondia que no tenia controlador para abrir cada mensaje, porque abrirlos exigia escalar al actuador visual. Ademas el ruteo no reconocia los imperativos con pronombre enclitico ("abrelos", "abrirlas") y clasificaba la peticion como lectura pasiva.

### Added

- **Controlador determinista del navegador integrado:** `click_browser_element`, `type_in_browser_element`, `scroll_integrated_browser` y `go_back_integrated_browser` actuan sobre la pestaña visible con entrada real del navegador, sin Computer Use y conservando cookies y sesion. Operan por la referencia `ref` que ya devolvia `read_browser_dom`: el elemento se resuelve vivo y su punto de impacto se recalcula al momento, de modo que el scroll o un re-render no desvian el clic, y una referencia vencida falla con un error que pide releer el DOM en vez de actuar sobre coordenadas obsoletas. El ciclo leer -> clic -> volver permite recorrer una bandeja completa. Un control irreversible (enviar, pagar, borrar, cerrar sesion) exige confirmacion explicita del usuario, y el controlador se rechaza sin pestaña visible o mientras Computer Use ya controla la vista.

### Changed

- **Costo de la percepcion del navegador:** Las capturas pasan de PNG a resolucion de dispositivo a JPEG en la escala que corresponde a cada uso, lo que elimina cientos de milisegundos de codificacion en el proceso principal y reduce en un orden de magnitud lo que viaja por IPC en cada percepcion y en cada apertura de la barra de direcciones. El recorrido de DOM clasifica cada nodo antes de medirlo (antes consultaba geometria y estilo de hasta 1800 elementos), respeta un presupuesto de tiempo dentro de la pagina y una rafaga de eventos de entrada extiende la ventana de calma sin reconstruir el temporizador en cada evento.

## [0.9.1] - 2026-08-05

### Fixed

- **SofLIA Pro y Max inutilizables en la version distribuida:** El workflow de release no escribia `VITE_OPENAI_API_KEY` en el `.env` del runner. Vite incrusta esas variables en tiempo de compilacion, asi que el instalador viajaba con la clave vacia y todo turno con un modelo OpenAI respondia "SofLIA Pro y Max requieren una clave de OpenAI valida en Configuracion" aunque el secret existiera en GitHub. El mismo hueco afectaba a `VITE_OPENAI_VECTOR_STORE_IDS`, `VITE_MICROSOFT_CLIENT_ID` y las dos variables de SofLIA Learning.
- **Respuestas vacias de Gemini sin explicacion:** Un turno que terminaba sin texto mostraba siempre "No obtuve una respuesta. Intenta de nuevo.", descartando el `finishReason` que venia en la respuesta. Ahora el bloqueo de seguridad, el presupuesto de tokens agotado por el razonamiento, la recitacion y la llamada de herramienta malformada producen un mensaje accionable, y el motivo queda registrado en consola.
- **Icono de Windows rechazado por el instalador:** `icono.ico` contenia una unica imagen de 256x170 y NSIS exige un lado minimo de 256, lo que abortaba el build de Windows. Los iconos de aplicacion se generan ahora desde el logotipo con `scripts/generate-app-icons.js`.
- **Build de macOS abortado por falta de memoria:** El runner de macOS tiene 7 GB y `tsc`, que pica en ~2.4 GB en este proyecto, superaba el heap por defecto de Node y terminaba con `Reached heap limit` (exit 134). El job fija el limite de heap y usa la cadena canonica `npm run build:mac`, que ademas recupera el chequeo de `tsconfig.node.json` que se habia perdido.

### Added

- **Compuerta de variables de build:** `scripts/quality/check-release-env.mjs` falla el release si alguna `VITE_*` que consume el codigo no se escribe en los tres bloques `.env` del workflow, o si una clave critica llega vacia al runner.

### Changed

- **Etiquetas de herramienta en el chat:** El indicador de actividad muestra un nombre legible para todas las herramientas del catalogo (Gmail, Drive, Calendar, IRIS, nodos remotos, navegador) en lugar del identificador tecnico.

## [0.9.0] - 2026-08-05

### Added

- **Navegador integrado completo:** Pulse Hub incorpora una superficie Chromium compartida entre el usuario y SofLIA, con sesion persistente aislada, historial, favoritos, sugerencias de direccion, gestor de credenciales cifradas y extensiones Manifest V3 desempaquetadas.
- **Pestañas, doble vista y ventanas separadas:** El navegador admite hasta 500 pestañas logicas con un presupuesto acotado de vistas activas, composicion dividida o superpuesta y hasta cuatro ventanas nativas separadas que conservan la misma sesion.
- **Asistente dentro del navegador:** El chat de SofLIA puede flotar, redimensionarse, minimizarse, cambiar de lado o sustituirse por la Orbe movible sin reducir permanentemente el espacio de la pagina.
- **Comprension real de la pagina:** SofLIA puede obtener captura y DOM semantico saneado de la pestaña activa, leer referencias contextuales, navegar de forma determinista y realizar busquedas web sin iniciar Computer Use cuando no es necesario.
- **Computer Use sobre la misma pagina:** Las acciones visuales reutilizan la pestaña, cookies y sesion visibles. El modelo elegido por el usuario conserva la orquestacion y `gemini-3.6-flash` actua exclusivamente como motor visual interno.
- **Catalogo multimodelo y razonamiento por proveedor:** SofLIA y Lite usan Gemini; SofLIA Max y Pro usan OpenAI. Cada modelo conserva su nivel compatible y los modelos OpenAI pueden utilizar busqueda web alojada.
- **Registro Operativo Gobernado (SDO):** Nueva vista de decisiones con fuentes, evidencia, claims, acciones, aprobaciones, vigencia, auditoria y documentos oficiales correlacionados mediante hash.
- **Reuniones y transcripciones accesibles:** Nueva entrada de Reuniones en la barra lateral, consulta de transcripciones, diarizacion de ambos canales y sesgo de vocabulario para mejorar nombres y terminos del contexto.
- **Sesion operativa federada:** El inicio de sesion visible de SOFIA puede resolver automaticamente la sesion de conversaciones de la misma identidad mediante un intercambio backend de un solo uso, sin compartir una segunda contraseña.
- **Agente de escritorio ampliado:** Se incorporaron planeacion por fases, presupuestos de tarea, percepcion verificable, UI Automation/OCR, entrada nativa y rutas gobernadas para automatizacion local y WhatsApp.
- **Arnes de desarrollo y OpenSpec:** El repositorio ahora incluye reglas canonicas, skills, adaptadores para Codex, Claude y Antigravity, especificaciones trazables y compuertas automatizadas de PR y release.

### Changed

- **Inicio de la aplicacion por fases:** La ventana principal se crea antes de inicializar servicios secundarios, muestra el renderer cuando esta listo e instrumenta tiempos de arranque para reducir la espera y evitar pantallas en blanco.
- **Percepcion del navegador adaptativa:** La captura pasiva se reduce a un maximo de 1024 px, usa una cadencia base de diez segundos, espera cuatro segundos de calma y cede durante cargas, interaccion o Computer Use.
- **Interfaz premium y minimalista:** Navegador, chat compacto, selectores de modelo y razonamiento, dialogos, historial, contraseñas y extensiones adoptan superficies redondeadas, densidad compacta y el sistema visual de SofLIA Learning.
- **Seleccion de razonamiento simplificada:** Se retiro el modo Rapido; las preferencias antiguas se migran a Bajo y los niveles se traducen al contrato propio de Gemini u OpenAI.
- **Autenticacion mas resistente:** Los fallos recuperables ya no destruyen la sesion valida de SOFIA, el renderer mantiene un unico gate de entrada y los servicios sensibles esperan un estado de autenticacion conocido.
- **Herramientas dinamicas gobernadas:** Los toolsets ejecutables ahora requieren esquemas cerrados, metadata de riesgo, permisos por agente y grupo, timeout, cancelacion, fingerprint y auditoria. Este cambio es incompatible con plugins dinamicos que no declaren el nuevo contrato.
- **Documentacion reorganizada:** `docs/`, `ai-specs/`, recursos runtime, migraciones y scripts se convirtieron en fuentes canonicas verificables; se retiraron snapshots, configuraciones locales y artefactos generados versionados.
- **Modelo predeterminado actualizado:** SofLIA utiliza `gemini-3.6-flash`; los modelos, fallbacks y prompts de servicios auxiliares se alinearon con el catalogo vigente.

### Fixed

- **Transcripciones y paneles dinamicos lentos:** La observacion de fondo ya no recorre el DOM ni comprime capturas completas durante la carga de YouTube y descarta capturas obsoletas cuando la pagina cambia.
- **Navegador congelado o en blanco:** Se corrigieron carreras de viewport, captura, visibilidad y control del agente que podian bloquear la pagina o provocar que la automatizacion intentara actuar fuera de Pulse Hub.
- **Predicciones que desplazaban la pagina:** El menu de la barra de direccion ahora se superpone como en un navegador convencional, conserva los insets reales y queda por encima del chat flotante.
- **Redirecciones OAuth y verificacion en dos pasos:** Los cambios de subframes autorizados ya no producen falsos errores globales; los protocolos no permitidos del frame principal continúan bloqueados.
- **SofLIA no reconocia el contenido visible:** Las referencias a mensajes, personas, enlaces o repositorios de la pagina activa solicitan evidencia vigente antes de responder y pueden leer el DOM sin depender del nivel de razonamiento.
- **Errores de seleccion de modelo:** Se restauro el catalogo completo, se corrigio la persistencia por modelo y se evita trasladar niveles exclusivos de OpenAI al actuador Gemini.
- **Reuniones ausentes o incompletas:** La lista de runs ahora cubre todas las identidades asociadas al usuario y la transcripcion visible conserva la atribucion de participantes.
- **Politicas faltantes en mensajes:** Se agregaron las politicas RLS necesarias para actualizar y eliminar mensajes sin relajar el aislamiento de lectura.

### Security

- **Aislamiento del navegador:** Las paginas se ejecutan sin Node ni preload, con sandbox, context isolation, web security, particion propia y allowlist de protocolos HTTP(S).
- **Boveda y extensiones protegidas:** Las contraseñas se cifran con `safeStorage` y nunca regresan al renderer; las extensiones requieren inspeccion, permisos visibles, confirmacion humana y verificacion SHA-256 antes de copiarse.
- **DOM y capturas minimizados:** La lectura omite valores de formularios, contenido editable, contraseñas, credenciales de URL y rutas locales; la evidencia contextual no concede autorizacion para ejecutar instrucciones de una pagina.
- **Servicios sensibles deny-by-default:** Orbe, WhatsApp, automatizacion y otros servicios protegidos no arrancan ni aceptan operaciones hasta conocer una sesion valida.
- **Aprobacion humana y auditoria:** Las acciones destructivas, permisos web y herramientas dinamicas de escritura o riesgo critico conservan confirmacion contextual, trace ID y resultado auditable.

## [0.8.0] - 2026-07-17

### Added

- **Transcripcion de reuniones en vivo (sin bot):** Con el Orb abierto, SofLIA detecta cuando estas en una reunion de Google Meet, Microsoft Teams o Zoom, te pregunta si quieres que tome notas y transcribe todo lo que se habla — 100% local en tu equipo, sin meter ningun bot a la llamada.
- **Minuta y resumen ejecutivo automaticos:** Al terminar la reunion, la transcripcion se convierte en una minuta con acuerdos y tareas, mas un resumen ejecutivo, listos para tu revision antes de sincronizarse a proyectos.
- **Identifica quien dijo que:** SofLIA separa a cada participante remoto por su voz e identifica sus nombres reales leyendo los recuadros de la videollamada, para que la minuta atribuya cada intervencion a la persona correcta.
- **Capturas de pantalla con contexto:** Durante la reunion se toman capturas periodicas y se lee su texto (slides, documentos compartidos) para enriquecer el resumen final.
- **Navegador real en control de la computadora:** Cuando una tarea necesita cuentas donde ya iniciaste sesion, SofLIA ahora usa tu navegador predeterminado real (Chrome, Edge, Brave, Opera, Vivaldi o Firefox) con tu perfil activo, en lugar de un navegador vacio sin tus contrasenas.
- **Respaldo de tus automatizaciones en la nube:** Tus workflows, plantillas y tareas programadas ahora se guardan en la base de datos de SofLIA Hub. Si formateas tu computadora o cambias de equipo, ya no los pierdes.

### Changed

- **Separacion clara de datos:** Lo operativo de SofLIA Hub (reuniones, workflows) vive en la base del Hub; a IRIS solo se le comparte el resultado aprobado (proyectos e incidencias). Las bases de datos ya no se mezclan.
- **Deteccion de la ventana activa mas robusta:** Nuevo mecanismo nativo para Windows, macOS y Linux que reemplaza una dependencia que habia dejado de funcionar en Windows, y que ahora permite detectar reuniones y automatizar con mayor fiabilidad.
- **La IA ya no se bloquea por limites de uso:** Cuando el proveedor responde con un limite de cuota temporal, SofLIA reintenta sola con una espera breve en lugar de quedar bloqueada; y los mensajes de error internos ya no se muestran al usuario.

### Fixed

- **La minuta no se podia guardar:** Las politicas de seguridad de la base de datos rechazaban la creacion de reuniones desde la app, y ademas habia una incompatibilidad de columnas al guardar. Ambos quedaron resueltos y el flujo completo de reunion a minuta ya funciona.
- **La transcripcion no arrancaba:** Se corrigio la captura de audio de la reunion, que quedaba bloqueada por la politica de seguridad de contenido, y el motor de transcripcion que no se encontraba dentro del paquete instalado.
- **El aviso de "¿Tomo notas?" se perdia:** Si la reunion se detectaba antes de abrir el Orb, el aviso no aparecia; ahora se recupera al abrir el Orb.

## [0.7.0] - 2026-07-12

### Added

- **Orb, el nuevo asistente de voz:** Reemplaza al antiguo Flow Mode. Una esfera 3D flotante que reacciona al sonido de la conversacion: le hablas, te responde con voz natural en espanol y puedes consultar el detalle de lo dicho en su panel de informacion.
- **Activacion por voz sin internet (experimental):** SofLIA puede escuchar una palabra clave para activarse, con reconocimiento 100% local — el audio nunca sale de tu computadora. Viene apagada de fabrica y se controla desde la nueva seccion de Voz en ajustes.
- **Motor Python integrado:** La app ahora incluye su propio motor de Python dentro del instalador, que habilita nuevas capacidades (voz local, lectura de documentos, privacidad) sin que tengas que instalar nada extra.
- **Lectura de documentos en tu computadora:** PDF, Word, Excel y PowerPoint ahora se leen localmente, incluyendo tablas. Mas rapido, sin el limite anterior de 15 MB y sin necesidad de subir el documento completo a la nube.
- **Proteccion de datos personales:** Nueva seccion de Privacidad en ajustes. SofLIA puede detectar y tachar datos sensibles (RFC, CURP, CLABE, tarjetas, telefonos y correos) antes de enviar contenido a la nube.
- **Modos de contexto para tu equipo:** Nuevo control que ajusta de una sola vez volumen, brillo, plan de energia y no molestar — por ejemplo para enfocarte, ver una pelicula o ahorrar bateria (solo Windows, disponible desde WhatsApp).
- **Soporte multi-monitor en capturas:** Si tienes varias pantallas, SofLIA ya puede verlas todas: captura la pantalla donde esta el cursor o la que le indiques.

### Changed

- **Inicio de sesion mas seguro:** La autenticacion del Hub y la verificacion de identidad por WhatsApp migraron al sistema estandar de Supabase Auth, eliminando de raiz los problemas de contrasenas que funcionaban o no segun donde se hubieran creado.
- **Chat mas estable:** Ahora puedes detener una respuesta en curso; si el servicio de IA esta saturado, SofLIA reintenta sola en segundos (antes habia que reenviar el mensaje a mano); y las respuestas ya no se pierden si cambias de conversacion mientras se generan.
- **SofLIA encuentra mejor tus carpetas:** Escritorio, Documentos y Descargas ahora se resuelven preguntandole directamente al sistema operativo, lo que corrige los casos de carpetas redirigidas a OneDrive y las diferencias en Mac y Linux.
- **WhatsApp al dia:** La libreria de conexion se actualizo a su version mas reciente, que incluye un parche de seguridad importante y mejoras de estabilidad en la recepcion de mensajes.
- **Instalador renovado:** Nuevas imagenes del instalador y desinstalador, fondo de instalacion para Mac y paquete .deb para Linux.

### Fixed

- **WhatsApp ignoraba tus mensajes (bug critico):** Si tu numero de telefono aparecia registrado mas de una vez en el sistema de usuarios, el asistente podia identificarte con el registro equivocado y dejar de responderte por completo. Ahora identifica correctamente tu cuenta activa y deja rastro en los registros cuando algo impide autorizar a un remitente.
- **No podias iniciar sesion aunque tu contrasena fuera correcta:** Usuarios con contrasenas creadas en SofLIA Learning no podian entrar al Hub. Quedo resuelto con la migracion de autenticacion.
- **La voz del asistente no sonaba para algunos usuarios:** La sintesis de voz fallaba en silencio cuando la clave del servicio no llegaba a la interfaz; ahora se procesa en el nucleo de la app con la configuracion correcta y la clave nunca se expone.

## [0.6.0] - 2026-07-05

### Added

- **Soporte para Linux:** SofLIA Hub ahora se puede instalar y usar en Linux, con inicio automatico al arrancar el sistema. Ya funciona en Windows, Mac y Linux.
- **Centro de comunicaciones por organizacion:** Nuevo sistema que unifica y controla los canales de mensajeria (WhatsApp, Telegram y futuros) a nivel de organizacion. El acceso por WhatsApp ahora valida que la persona pertenezca activamente a tu organizacion antes de responder.
- **Agente de escritorio mas confiable:** El control de la computadora se volvio mas preciso y estable: movimiento del cursor mas natural, mejor deteccion de las aplicaciones instaladas, auto-calibracion de la pantalla al iniciar y un limite por tarea para evitar que se quede dando vueltas.
- **SofLIA aprende de ti:** Nuevo sistema de aprendizaje que recuerda tus correcciones, preferencias y patrones entre sesiones para mejorar con el uso.
- **Busqueda web verificada en el chat:** El chat detecta automaticamente cuando una pregunta necesita informacion actualizada (noticias, precios, datos recientes) y responde citando fuentes verificadas.
- **Creacion de documentos de Word:** SofLIA puede generar documentos profesionales con portada, titulo, autor y contenido, y guardarlos directamente en el escritorio.
- **Busqueda de chats:** Nuevo buscador rapido de conversaciones con filtrado en tiempo real y agrupacion por fecha (Hoy, Ayer, ultimos 7 dias y anteriores).
- **Chats fijados:** Ahora puedes fijar tus conversaciones mas importantes en una seccion dedicada de la barra lateral.
- **Consola de canales por organizacion:** Nueva vista para ver y gestionar los canales de comunicacion registrados en tu organizacion.
- **Novedades visuales en la app:** El panel de actualizaciones ahora muestra las notas de version con un formato visual mas claro y atractivo.
- **Lectura de texto en imagenes sin conexion:** El reconocimiento de texto (espanol e ingles) ahora viene incluido para funcionar sin internet.

### Changed

- **Renovacion visual completa:** Se unifico el diseno en toda la aplicacion (configuracion, barra lateral, WhatsApp, paneles y chat) para una experiencia mas consistente y pulida, tanto en modo claro como oscuro.
- **Tu tema se recuerda:** La app ahora conserva tu preferencia de tema (claro/oscuro) entre sesiones en lugar de reiniciarla cada vez.
- **Mas seguridad por defecto:** El acceso desde grupos de WhatsApp viene deshabilitado de fabrica, y el acceso individual se valida contra la membresia de tu organizacion.
- **Permisos del numero maestro configurables:** El numero principal de WhatsApp ahora tiene permisos ajustables en detalle (antes tenia acceso total automatico).
- **Contenido filtrado por organizacion:** Proyectos, equipos, reuniones e incidencias ahora se pueden ver filtrados por la organizacion activa.
- **Barra lateral y menu de usuario renovados:** Nueva estructura con busqueda, chats fijados y mas opciones de configuracion a la mano.

### Fixed

- **Acceso no autorizado a WhatsApp:** Los mensajes de numeros en la lista de permitidos pero sin membresia activa en la organizacion ahora se rechazan correctamente.
- **El tema se reiniciaba al recargar la app:** Ahora tu preferencia de tema se guarda y se restaura como corresponde.
- **Tareas fantasma del agente de escritorio:** Las tareas que quedaban en cola despues de que el usuario las abandonaba ya no se ejecutan por sorpresa; ahora expiran y se pueden cancelar.
- **Apertura de aplicaciones mas honesta:** Al abrir una app, SofLIA confirma que la ventana realmente aparecio antes de reportar exito, en vez de enfocar ventanas del sistema por error.

## [0.5.3] - 2026-06-20

### Added

- **Tareas programadas en WhatsApp (Scheduled Tasks):** El agente de WhatsApp ahora puede crear, listar y cancelar tareas programadas directamente desde la conversacion. El contexto de la tarea se genera con memoria activa del usuario para que el agente retome el hilo correctamente cuando se dispara.
- **Auto-extraccion de hechos desde resumenes:** Despues de cada resumen de sesion, Gemini extrae automaticamente hechos estructurados (preferencias, contexto de trabajo, personas clave, compromisos) y los guarda como `facts` persistentes. Esto crea una memoria declarativa que no envejece y es consultable en cualquier sesion futura.
- **Herramientas de ciclo de vida de aplicaciones:** Nuevas capacidades para gestionar el estado de procesos y aplicaciones desde el agente de WhatsApp, incluyendo verificacion de ventanas activas post-lanzamiento.

### Changed

- **Sistema de memoria reforzado para recall de largo plazo:** El contexto del agente ahora incluye los ultimos 5 resumenes de sesion (antes solo el mas reciente), con fechas de periodo visibles, permitiendo a SofLIA recordar conversaciones de semanas atras. `SEMANTIC_TOP_K` subio de 5 a 10 y `SEMANTIC_MIN_SCORE` bajo de 0.30 a 0.22 para ampliar el alcance semantico. `FACTS_TOKEN_BUDGET` paso de 1000 a 1800 tokens.
- **Timeline recall ampliado a 30 entradas:** Las consultas de memoria temporal ("hace dos semanas", "la semana pasada") ahora recuperan hasta 30 mensajes del periodo en lugar de 16.
- **Seccion de resumenes con contexto cronologico:** El formateador de contexto etiqueta cada bloque de resumen con su rango de fechas (`[3 jun — 5 jun]`) para que el modelo pueda ubicar temporalmente los eventos al responder.
- **`UNIQUE INDEX` en tabla `facts`:** Se agrego el indice unico `idx_facts_unique` sobre `(COALESCE(phone_number,''), category, fact_key)` para que el upsert `ON CONFLICT` funcione correctamente. La migracion deduplica filas existentes antes de crear el indice.
- **Historial en SQLite guarda ambos roles:** `persistFinalText` ahora guarda tanto el mensaje del usuario como la respuesta del modelo en SQLite (antes solo el modelo), asegurando que el historial recuperado tras un reinicio tenga pares completos user/model.

### Fixed

- **Perdida de contexto entre mensajes de WhatsApp (bug critico):** `persistFinalText` actualizaba `state.historyCopy` (copia local) pero nunca la sincronizaba de vuelta al `Map` de `conversations`. En cada mensaje nuevo, el agente reconstruia el historial desde el Map original vacio, causando que SofLIA "olvidara" todo lo conversado en la misma sesion. Fix: `state.conversations.set(state.sessionKey, state.historyCopy)` al final de cada turno.
- **`open_application` reportaba exito cuando la ventana no aparecia:** `focusExistingApplicationWindow` coincid­ia con el proceso shell de Windows (`explorer.exe` del escritorio/barra de tareas) porque tenia `MainWindowHandle != 0` pero `MainWindowTitle` vacio. SofLIA decia "ya lo traje al frente" cuando en realidad habia "enfocado" el escritorio. Fix: se agrego el filtro `$_.MainWindowTitle -ne ''` para excluir ventanas de sistema sin titulo visible.
- **Lanzamiento de aplicaciones sin verificacion de ventana:** `launchPathNonBlocking` retornaba `success: true` en cuanto `Start-Process` arrancaba el proceso, sin confirmar que la ventana realmente apareciera. Ahora `open_application` espera 1.8 segundos post-lanzamiento y verifica que la ventana exista via `focusExistingApplicationWindow`. Si no aparece, retorna `success: false` con mensaje honesto.

## [0.5.2] - 2026-05-29

### Added

- **Guardia de intencion para herramientas operativas de WhatsApp:** el agentic loop bloquea herramientas de computadora, navegador, archivos, chats internos de SofLIA, Google Workspace, IRIS, comandos, creacion/envio de archivos y mensajes externos cuando el mensaje actual no solicita una accion explicita.
- **Cobertura de regresion para stickers, reacciones y filtrado de herramientas:** nuevos tests verifican que interacciones pasivas no llegan a Gemini, que los turnos vacios no responden y que llamadas como `execute_command` se bloquean antes de pedir confirmacion si el usuario no las pidio.

### Changed

- **Prompt WhatsApp menos agresivo con herramientas:** las reglas ahora distinguen entre solicitud clara, continuidad explicita e interacciones sociales; stickers, reacciones, saludos y acompanamiento conservan la personalizacion/mensajes motivacionales, pero no autorizan computadora, navegador, chats internos, confirmaciones, flujos ni archivos.
- **Deteccion de acciones mas precisa:** `puedes` dejo de contar como accion por si solo y solo activa herramientas cuando acompana un verbo operativo como crear, enviar, revisar o guardar.
- **Confirmaciones HITL mas claras:** el mensaje de confirmacion ya no duplica "Confirmar Confirmacion requerida" e indica que se cancele si la accion no fue solicitada.

### Fixed

- **Stickers y reacciones activaban procesos no pedidos:** WhatsApp ahora registra stickers/reacciones como interacciones pasivas y no emite un mensaje al agente, evitando ejecuciones por texto vacio o por contexto viejo.
- **Archivos y flujos enviados sin solicitud actual:** `create_document`, `whatsapp_send_file` y herramientas similares quedan bloqueadas si el usuario no pidio explicitamente crear/recibir/continuar un archivo.
- **Fuga de razonamiento interno en WhatsApp:** la normalizacion de salida elimina secciones internas como `custom_theme`, `slides_json`, `include_images` y frases de planeacion tipo "Wait, should I call..." antes de enviar el texto.

## [0.5.1] - 2026-05-28

### Changed

- **Migración a Gemini 3.5 Flash como modelo principal:** `PRIMARY` y `WEB_AGENT` actualizados de `gemini-3-flash-preview` a `gemini-3.5-flash` (stable) en `src/config.ts` y en todos los servicios del main process que usaban el modelo hardcodeado: WhatsApp agent, memoria, resúmenes, proactivo, meeting ops, neural organizer, clipboard AI, browser web service y desktop agent.
- **Migración a Gemini 3.1 Flash-Lite como modelo de respaldo:** `FALLBACK`, `TRANSCRIPTION` y `MAPS` actualizados de `gemini-2.5-flash` a `gemini-3.1-flash-lite` (stable) en config y servicios: daily briefing, llm-task-service, url-summarizer, windows UIA, presentation workflow y flow mode.
- **`gemini-2.5-pro` reemplazado por `gemini-3.1-pro-preview`:** Desktop agent (model, fallbackModel, proactiveModel) y presentation workflow actualizados al modelo Pro activo.
- **Selector de modelos UI actualizado:** `model-selector-options.ts` ahora ofrece SofLIA (`gemini-3.5-flash`), SofLIA Pro (`gemini-3.1-pro-preview`) y SofLIA Lite (`gemini-3.1-flash-lite`). Eliminadas las opciones SofLIA Deep (`gemini-2.5-pro`) y SofLIA Swift (`gemini-2.5-flash`) por obsolescencia.

### Fixed

- **Búsquedas web con CAPTCHA bloqueando al agente WhatsApp:** `webSearch` en `web-tools.ts` ahora usa el tool nativo `googleSearchRetrieval` de la SDK de Gemini en lugar de scraping directo de HTML de DuckDuckGo/Google. Al pasar por la API oficial, el CAPTCHA desaparece completamente. El scraping HTML se mantiene solo como fallback de emergencia si no hay API key disponible.

## [0.5.0] - 2026-05-28

### Added

- **Sistema de control de acceso WhatsApp (`access-control.ts`):** Nuevo modulo que implementa numero maestro, permisos granulares por contacto (11 categorias: archivos, pantalla, control PC, terminal, portapapeles, Google Workspace, mensajeria, sistema, automatizaciones, nodos remotos) y filtrado dinamico de herramientas segun permisos del remitente.
- **Tarjeta de Acceso Maestro en la UI (`MasterAccessCard`):** Nuevo componente en el panel de WhatsApp que permite configurar el numero maestro, ver numeros autorizados y habilitar/deshabilitar permisos individuales por contacto con toggles visuales.
- **Comando `/permisos` en WhatsApp:** Nuevo comando de chat (aliases `/permisoswa`) exclusivo para el numero maestro que permite listar, dar, quitar y limpiar permisos de contactos directamente desde WhatsApp, con aliases en español para cada permiso.
- **Nombre del agente dinamico en system prompt:** El system prompt ahora reemplaza `{{AGENT_NAME}}` con el `displayName` del perfil activo, permitiendo que el agente se presente con el nombre configurado por perfil en vez de usar siempre "SofLIA".
- **Tareas programadas de ejecucion unica (`runOnce`):** El `TaskScheduler` ahora soporta tareas que se ejecutan una sola vez en el minuto programado y se auto-eliminan despues, con limpieza automatica de tareas expiradas al iniciar.
- **Reglas de flexibilidad tonal en personalizacion:** El prompt del agente ahora incluye reglas contextuales segun el tono configurado (profesional vs. no profesional) y expande el alcance conversacional a vida diaria, relaciones y bienestar general, no solo productividad.
- **Canal IPC `whatsapp:set-access-config`:** Nuevo canal registrado en preload, handlers y service-ipc para persistir configuracion de acceso maestro y permisos por contacto desde el renderer.
- **Tests de control de acceso y permisos:** Nuevos tests que validan bloqueo por permisos en grupos, ejecucion de herramientas filtradas por acceso, y reglas pasivas con `runOnce` y `scheduledFor`.

### Changed

- **Visibilidad de herramientas filtrada por permisos:** `buildWhatsAppToolDeclarations` ahora recibe `senderNumber` y `whatsappConfig` para excluir herramientas a las que el remitente no tiene acceso, en vez de solo filtrar por grupo.
- **Guardias de ejecucion con control de acceso:** `evaluateToolGuards` ahora evalua permisos del remitente antes de ejecutar cualquier herramienta, devolviendo mensajes claros indicando que permiso falta y como solicitarlo.
- **Numero maestro como bypass de seguridad:** `isAllowedNumber` y `isAllowedGroupSender` ahora permiten automaticamente al numero maestro sin importar configuracion de whitelist o politica de grupo.
- **Prompt de identidad dinamico:** La seccion de seguridad del system prompt usa `{{AGENT_NAME}}` en vez de "SOFLIA" hardcodeado, y la descripcion de identidad pasa de "asistente OMNIPOTENTE" a "asistente de IA operativo y personal" con lenguaje mas preciso sobre capacidades y permisos.
- **Regla de continuidad conversacional:** Nuevo parrafo en el prompt que instruye al agente a interpretar referencias contextuales ("eso", "lo anterior", "para ese numero") contra mensajes recientes y memoria antes de pedir que el usuario repita todo.
- **Historial de reintentos preservado:** Al detectar un mensaje de reintento, la conversacion ahora conserva las ultimas 8 entradas de historial en vez de borrar todo, manteniendo contexto util para completar la tarea.
- **Limite de mensajes recientes ampliado a 30:** `RECENT_MESSAGES_LIMIT` y la carga de historial persistido pasan de 20 a 30 entradas para dar mas contexto al agente.
- **Confirmacion de cambio de nombre en `/perfil`:** Al cambiar `displayName` via comando, el agente ahora confirma explicitamente que se presentara con el nuevo nombre.
- **`dailyBriefingService` prioriza numero maestro:** La inicializacion y actualizacion del `ownerNumber` ahora prefieren `masterNumber` sobre el primer numero de la whitelist.
- **Notificaciones WhatsApp incluyen numero maestro:** `notifyAllowedWhatsAppNumbers` ahora incluye al numero maestro en la lista de destinatarios, deduplicando automaticamente.
- **UI de WhatsApp Flows con etiquetas legibles:** `WhatsAppFlowsCard` ahora muestra etiquetas como "Todos los dias a las 09:00" o "Lunes a viernes a las 14:30" en vez de expresiones cron crudas, e incluye soporte para tareas de ejecucion unica con selector de fecha/hora.
- **Tipos de workflow-hub extendidos:** `PassiveWorkflowRule`, `SavePassiveWorkflowRuleInput` y `ScheduledTaskInfo` ahora incluyen `runOnce` y `scheduledFor` en todas las capas (tipos, mappers, servicio, renderer).
- **Prompt de acceso inyectado al agente:** El contexto del system prompt ahora incluye una seccion `=== PERMISOS DE WHATSAPP ===` que informa al agente sobre el estado del numero maestro y los permisos del remitente actual.

### Fixed

- **Tareas cron de ejecucion unica disparando en minutos incorrectos:** Las tareas `runOnce` con `scheduledFor` ahora verifican que el minuto actual coincida con el programado antes de disparar, y se auto-eliminan si ya expiraron.

## [0.4.0] - 2026-05-27

### Added

- **Historial de conversaciones WhatsApp (`WhatsAppConversationHistoryStore`):** Nuevo subsistema que persiste cada evento de WhatsApp (texto, media, audio, transcripciones, ejecucion de tools) en un archivo JSONL local con filtros por JID, contacto, direccion, tipo, rango temporal y busqueda libre.
- **Timeline Recall — capa de memoria temporal:** Nuevo modulo `timeline-recall.ts` que parsea consultas en lenguaje natural en español ("¿que hablamos ayer?", "recuerdas lo de hace 2 semanas?", "el 15/03") y recupera fragmentos relevantes del historial de mensajes SQLite, inyectandolos como contexto fechado en el prompt del agente.
- **Tarjeta de Historial en la UI de WhatsApp (`WhatsAppHistoryCard`):** Nueva seccion en el panel de configuracion de WhatsApp que muestra estadisticas globales (total, entradas, salidas, tools, media) y un visor de eventos recientes con fecha, tipo y contenido.
- **Canales IPC `whatsapp:get-conversation-history` y `whatsapp:get-conversation-history-stats`:** Nuevos canales registrados en preload, handlers y service-ipc para consultar historial y estadisticas desde el renderer.
- **Grabacion automatica en todos los flujos de mensajes:** Texto entrante, texto saliente (incluyendo mensajes partidos), archivos enviados (imagen, video, documento), ejecucion de tools, transcripciones de audio y mensajes bloqueados por jailbreak ahora se registran automaticamente en el historial.
- **Tests de historial de conversaciones:** Nuevos tests `WA-022`, `WA-026` y `WA-030` verifican grabacion de mensajes entrantes, media entrante, mensajes salientes, mensajes partidos y metadata de bloqueo por jailbreak.

### Changed

- **Retencion de memoria extendida a 10 años:** `compactOldData` ahora conserva datos por 3650 dias (antes 90), evitando la eliminacion prematura de historial valioso para el agente.
- **Contexto de memoria con timeline recall:** `assembleContext` ahora incluye `timelineRecall` junto a `recentMessages`, `rollingSummary`, `semanticRecall` y `facts`, y el formateador de contexto inyecta una seccion `=== RECUERDOS FECHADOS DEL HISTORIAL WHATSAPP ===` cuando hay resultados temporales relevantes.
- **Log de contexto de memoria ampliado:** El log del agente WhatsApp ahora reporta la cantidad de entradas de timeline recall ademas de mensajes recientes, resumen, semantico y hechos.
- **Tipos de WhatsApp extendidos:** `WhatsAppServiceCore` ahora requiere `recordHistory()` como parte del contrato, asegurando que cualquier implementacion registre eventos.

## [0.3.1] - 2026-05-27

### Added

- **Gestion de perfil por WhatsApp (`/perfil`):** Nuevo comando de chat `/perfil` (aliases `/personalizar`, `/personalizacion`) que permite ver, editar y reiniciar la personalizacion del agente directamente desde WhatsApp. Soporta campos: nombre, trato, tono, estilo, contexto, instrucciones y flujos.
- **Herramienta `whatsapp_update_profile`:** Nueva tool del agente que persiste cambios de personalizacion automaticamente cuando el usuario pide cambiar nombre, tono o comportamiento en lenguaje natural, sin necesidad de comandos.
- **Modulo `profile-update.ts`:** Logica centralizada para resolver el perfil activo (global, contacto o grupo), normalizar campos, formatear el perfil visible y construir patches de actualizacion.
- **Handler de ejecucion `profile.ts`:** Nuevo executor handler que valida y aplica patches de personalizacion desde el agentic loop, con soporte de reset por perfil.
- **Tab dedicado de WhatsApp en Configuracion:** Nuevo tab `WhatsApp` en el panel unificado de settings, permitiendo acceso directo a la configuracion de WhatsApp sin pasar por Conexiones.
- **Tests de `/perfil` y personalizacion por grupo:** Nuevos tests `WA-043` que validan la persistencia de personalizacion por contacto (con whitelist activa) y por grupo desde chats grupales.

### Changed

- **Personalizacion de grupos independiente del allowlist:** La personalizacion de grupo ya no requiere que el grupo este en `allowedGroups`. Cualquier grupo con JID valido (`@g.us`) puede tener perfil persistente, permitiendo personalizar grupos incluso sin estar en la whitelist.
- **Prompt de personalizacion con instruccion de persistencia:** El system prompt del agente ahora incluye la instruccion explicita de usar `whatsapp_update_profile` cuando el usuario pide cambios de nombre, tono o comportamiento, asegurando que los cambios se persistan antes de responder.
- **Selector de perfiles ampliado en la UI:** `AgentPersonalizationCard` ahora muestra grupos con perfil existente ademas de los grupos permitidos, unificando ambas fuentes para el selector de perfil.
- **Eliminacion de grupo no borra su personalizacion:** Al remover un grupo del allowlist, su perfil de personalizacion se mantiene intacto para que no se pierdan configuraciones si se vuelve a agregar.
- **`resolveAllowedGroup` con fallback a JID normalizado:** Grupos no registrados en el allowlist ahora resuelven al JID normalizado en vez de `null`, habilitando personalizacion para cualquier grupo activo.
- **Texto de test `WA-030B` actualizado:** El test de personalizacion de grupos refleja el nuevo comportamiento donde los perfiles se almacenan independientemente del allowlist.

### Fixed

- **Perfiles de grupo huerfanos al eliminar del allowlist:** Antes, eliminar un grupo del allowlist tambien borraba su personalizacion y forzaba redireccion al perfil global. Ahora solo se elimina de `allowedGroups` sin afectar perfiles existentes.

## [0.3.0] - 2026-05-27

### Added

- **Personalizacion del agente WhatsApp por contacto y grupo:** Nuevo sistema que permite configurar nombre, tono, estilo de respuesta, alias del usuario, contexto e instrucciones personalizadas a nivel global, por contacto (whitelist) o por grupo. Incluye el tono `emotional_support` con guardrails de seguridad dedicados.
- **Tarjeta de personalizacion en la UI de WhatsApp:** Nuevo componente `AgentPersonalizationCard` con selector de perfil (global / contacto / grupo), campos editables de personalización y guardado independiente por perfil.
- **Flujos pasivos por perfil (WhatsApp Flows):** Nueva tarjeta `WhatsAppFlowsCard` que permite crear, listar y eliminar reglas de flujo pasivo asociadas a un contacto o al perfil global, directamente desde la configuracion de WhatsApp.
- **Toggle de whitelist:** La whitelist de numeros personales ahora puede habilitarse o deshabilitarse sin borrar los numeros guardados, controlando si el filtro se aplica o no.
- **Canal IPC `whatsapp:set-personalization`:** Nuevo canal registrado en preload, handlers y service-ipc para persistir cambios de personalizacion desde el renderer.
- **Prompt de personalizacion inyectado al agente:** El system prompt del agente WhatsApp ahora recibe instrucciones de personalización resueltas segun el remitente (contacto, grupo o global), incluyendo guardrails para tono de apoyo emocional.
- **Modulo `phone-utils`:** Funciones `normalizePhoneNumber` y `numbersMatch` extraidas a un modulo reutilizable, eliminando duplicacion entre `security.ts` y `personalization.ts`.

### Changed

- **Normalizacion robusta de configuracion WhatsApp:** `loadConfig` y `saveConfig` ahora pasan por `normalizeWhatsAppConfig`, que valida y normaliza personalización global, por contacto y por grupo en cada lectura y escritura.
- **`isAllowedNumber` respeta `whitelistEnabled`:** El filtro de seguridad ahora solo bloquea numeros no registrados cuando la whitelist esta explicitamente habilitada.
- **`setAllowedNumbers` normaliza numeros:** Los numeros se limpian con `normalizePhoneNumber` antes de guardar y la whitelist se desactiva automaticamente si la lista queda vacia.
- **`setGroupConfig` normaliza config:** Al actualizar configuracion de grupos, la config resultante pasa por `normalizeWhatsAppConfig` para mantener consistencia.
- **Estado de WhatsApp ampliado:** `getStatus()` ahora incluye `whitelistEnabled`, `globalPersonalization`, `contactPersonalizations` y `groupPersonalizations`.
- **`PersonalWhitelistCard` con toggle de activacion:** La tarjeta de whitelist ahora muestra un switch para activar/desactivar el filtro y valida duplicados antes de agregar numeros.
- **Limpieza al eliminar contacto o grupo:** Al remover un numero o grupo, se eliminan tambien sus personalizaciones asociadas y se redirige al perfil global si estaba seleccionado.

### Fixed

- **Duplicados en whitelist y grupos:** Ahora se valida que el numero o grupo no exista antes de agregarlo, mostrando un mensaje de error claro.
- **Seleccion huerfana al eliminar perfil:** Si se elimina el contacto o grupo actualmente seleccionado en personalización, la seleccion vuelve automaticamente al perfil global.

## [0.2.0] - 2026-05-09

### Added


### Changed

- **Rediseño de Interfaces de Carpeta y Chats:** Se rediseñaron las interfaces de los componentes de carpeta y chats, implementando una mejor organización visual y experiencia de usuario.

### Fixed

- **Correccion sobre actualizaciones en los chats y carpeta:** Se corrigio un bug que impedía que las actualizaciones en los chats y carpetas se reflejaran en tiempo real.

- 
## [0.1.10] - 2026-03-26

### Added

- **Triggers nativos de reuniones desde la extension:** SofLIA ahora atiende `soflia://meeting-trigger` para iniciar, mantener y cerrar sesiones `meeting_auto` desde el navegador, reutilizando el motor de monitoreo operativo de la app.
- **Cobertura de pruebas para meeting triggers de escritorio:** Se agregaron pruebas del protocolo de app, del workflow de reuniones y del servicio renderer que decide cuando arrancar, ignorar o cerrar una sesion automatica.

### Changed

- **Meeting Ops con trazabilidad operativa real:** La documentacion, el Workflow Hub y los mensajes del flujo de reuniones ahora distinguen claramente entre la sesion de evidencia `meeting_auto` y el `meeting_run` formal respaldado por artifacts.
- **Monitoreo enriquecido para reuniones detectadas externamente:** Los snapshots y logs de actividad ahora etiquetan el origen `meeting_auto` para que passive detection y los flujos posteriores puedan reconstruir mejor el contexto de la sesion.

### Fixed

- **Sesion automatica mezclada entre usuarios locales:** El estado persistido de una reunion detectada por extension ya no puede reutilizar ni cerrar por error una sesion guardada para otro usuario del mismo equipo.
- **Rutas de rechazo y cancelacion en reuniones:** El workflow de reuniones responde de forma mas consistente cuando el usuario rechaza, cancela o retoma un caso iniciado por deteccion pasiva o por trigger externo.

## [0.1.9] - 2026-03-26

### Added

- **Contexto de chats internos desde WhatsApp:** SofLIA ahora puede listar conversaciones de la app, leer contexto reciente, agregar notas a un chat existente y recuperar archivos generados o adjuntos dentro de esa conversacion para enviarlos por WhatsApp.

### Changed

- **Agente de WhatsApp con memoria operativa cruzada:** El prompt y el dispatcher del agente ahora reconocen cuando el usuario se refiere a "un chat de la app" y resuelven la conversacion correcta antes de actuar sobre ella.

### Fixed

- **Conversaciones recortadas entre dispositivos:** Se corrigio la sincronizacion remota para que un equipo con historial incompleto ya no borre mensajes existentes en Supabase al guardar un chat.
- **Actualizacion tardia del contenido del chat activo:** El chat abierto ahora refresca mensajes y metadata por realtime al cambiar en otro dispositivo, y volver a abrir la misma conversacion fuerza una recarga real del contenido.
- **Bloqueo falso por palabras sensibles dentro de notas internas:** Las referencias legitimas a rutas o conceptos tecnicos dentro de notas de un chat ya no disparan el guardia de autoproteccion del agente cuando la accion es sobre conversaciones internas.

## [0.1.8] - 2026-03-24

### Changed

- **Chats y carpetas compartidos ahora se distinguen mejor:** La app muestra estados visuales separados para elementos "Compartidos" y "Recibidos", ayudando a identificar de inmediato que vienen de otro flujo de colaboracion.
- **Apertura de enlaces internos de comparticion:** SofLIA ahora registra y atiende el protocolo `soflia://share/...` para abrir chats y carpetas compartidas desde la misma app.

### Fixed

- **Renombrado de conversaciones con guardado tardio:** El cambio de nombre ahora se refleja de inmediato en UI y sigue sincronizando en segundo plano, evitando la sensacion de que "no se guardo".
- **Eliminacion de conversaciones sin efecto:** Antes podian quedar bloqueadas por referencias activas en tablas relacionadas; ahora se limpian dependencias remotas antes de borrar el chat.
- **Comparticion hacia miembros de la organizacion:** Se corrigio el uso del identificador de Lia al compartir, en lugar de mezclarlo con el de SOFIA, para que el recurso realmente llegue al companero correcto.
- **Disponibilidad falsa de miembros para compartir:** El modal ya no habilita miembros que aun no activan Lia; ahora los marca correctamente como no disponibles hasta que tengan perfil sincronizado.
- **Tokens de comparticion sin resolucion en la app:** Los enlaces internos de chats y carpetas compartidas ahora se resuelven dentro de la sesion actual y muestran retroalimentacion si el recurso no esta disponible.

## [0.1.7] - 2026-03-23

### Fixed

- **Timeout en flujos activos de WhatsApp:** Los workflows de presentacion y reuniones ahora se cancelan automaticamente tras 5 minutos de inactividad y recuerdan al usuario que puede escribir `cancelar` para salir.
- **Bucle de respuesta generica del agente:** El agente ya no debe caer en respuestas repetidas como "¿En qué puedo ayudarte?" ante solicitudes sustantivas; ahora detecta ese fallback y reintenta la atencion real del mensaje.
- **Promesas vacias de investigacion:** Cuando el usuario pide investigar o revisar algo, el agente ahora fuerza ejecucion real de herramientas en lugar de responder que "va a investigar" sin hacer nada por detras.
- **Texto corrupto en salidas de WhatsApp:** Se agrego saneamiento de mojibake para normalizar caracteres rotos antes de formatear y enviar respuestas por WhatsApp.

## [0.1.6] - 2026-03-23

### Added

- **Dictado por voz en chat:** El boton de microfono ahora activa dictado real usando Web Speech Recognition API (es-MX) con auto-stop por silencio de 2.5s, insertando el texto transcrito directamente en el campo de mensaje.

### Changed

- **Panel de conexiones unificado:** WhatsApp, Telegram y Google Workspace se gestionan ahora desde un unico panel "Conexiones" en configuracion, en lugar de estar dispersos en distintas secciones.
- **Branding de modelos SofLIA:** Los nombres de los modelos Gemini ahora se muestran como SofLIA Pro, SofLIA, SofLIA Lite, SofLIA Deep y SofLIA Swift.
- **Boton de enviar con paleta correcta:** El boton de enviar usa ahora el color accent del sistema en lugar de indigo, y esta correctamente alineado al fondo del textarea.

### Fixed

- **Foto de perfil del usuario no visible:** El avatar no se mostraba porque `saveSofiaSession` guardaba el objeto del RPC (sin `profile_picture_url`) en vez del perfil completo. Ahora se resuelve el avatar desde `sofiaProfile.avatar_url`. Ademas, el componente `UserAvatar` no reseteaba su estado de error al cambiar la URL, quedando permanentemente en fallback.
- **Sesion de Lia en modo desarrollo:** Se agrego `refreshSession()` como fallback y cache de credenciales en localStorage para re-autenticar automaticamente tras HMR/reload.
- **Typo en .env:** Corregido `eeyJ...` → `eyJ...` en `VITE_SUPABASE_ANON_KEY` que causaba "Failed to fetch".
- **Error de tipo en vite.config.ts:** Resuelto el error IDE en el import dinamico de Electron.

## [0.1.5] - 2026-03-23

### Fixed

- **Secrets de Lia actualizados:** Se re-sincronizaron las claves `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en GitHub Secrets para que coincidan con el proyecto actual de Supabase.
- **Variables de entorno en produccion:** El preload de Electron no recibia las variables `VITE_*` en el build empaquetado porque `vite.config.ts` solo aplicaba `define` al main process. Ahora el preload tambien las incrusta en build-time.
- **Sincronizacion de chats restaurada:** Flujo completo de configuracion de Supabase (Lia) con diagnosticos, fallback renderer/runtime y mensajes claros cuando la clave no es valida.

### Changed

- **AuthContext robusto:** Sincronizacion SOFIA + Lia unificada con migracion de cache legado y refresco mas confiable entre dispositivos.

## [0.1.2] - 2026-03-22

### Added

- **Workflow Hub operativo:** Se agrego un hub central para flujos de correo, agenda, seguimiento, reuniones, Drive, actualizacion de equipo y acciones de PC, con variantes, reglas pasivas, casos y aprobaciones.
- **Compartido organizacional de conocimiento conversacional:** Chats y carpetas ahora pueden compartirse entre miembros de la organizacion con permisos de lectura o edicion y consumo unificado desde la app.
- **Modo voz renovado para escritorio:** Se sumaron dictado contextual al campo activo, limpieza rapida de transcripcion/respuesta y nuevas pruebas de regresion para el Desktop Agent.

### Changed

- **Sincronizacion SOFIA + Lia unificada:** La identidad de sesiones y conversaciones ahora se resuelve de forma consistente entre dispositivos, con migracion de cache legado y refresco mas confiable de chats y carpetas.
- **Experiencia de voz simplificada:** El antiguo lenguaje y overlay de Flow se sustituyen por una experiencia mas minimalista, con `Enter` para enviar, menos controles redundantes y dictado directo cuando el panel no esta abierto.
- **Desktop Agent mas robusto en geometria:** Se reforzaron captura enfocada, resolucion multi-monitor, snapping semantico sobre elementos UIA y tolerancia al padding para reducir errores de coordenadas en tareas locales.
- **Stack del agente visual estabilizado:** El Desktop Agent y Windows UIA quedaron alineados a una combinacion mas estable de Gemini 2.5 Flash y Gemini 2.5 Pro para ejecucion y replaneacion.

### Fixed

- **Conversaciones fuera de sincronizacion:** Se corrigieron desajustes entre laptop y escritorio para que las conversaciones queden guardadas en base de datos y reaparezcan con la misma identidad en cualquier equipo.
- **Compartido bloqueado por dependencia falsa de Lia:** Se elimino el bloqueo incorrecto al compartir con miembros de la organizacion y se habilito el uso de IDs de SOFIA/Lia segun corresponda.
- **Modo voz y paneles flotantes:** Se resolvieron respuestas vacias, cierres inesperados al dictar acciones, paneles cortados, recuadros oscuros sobrantes y se restauro el atajo global `Ctrl + M`.
- **Automatizacion visual y coordenadas:** Se corrigieron errores al abrir apps, enfocar ventanas, buscar elementos de barra lateral o barra de tareas y ejecutar clicks fuera de los limites visibles por padding o escalado.
- **Estabilizacion operativa del release local:** Se ajustaron integraciones y pruebas alrededor de Gmail, Google Chat, WhatsApp, paneles operativos y servicios auxiliares para reducir falsos negativos y fallos de flujo.

## [0.1.1] - 2026-03-21

### Security

- **Capa reforzada de seguridad del agente:** Se consolidaron protecciones contra prompt leak, extraccion de codigo fuente, manipulacion del rol del asistente, acceso a rutas sensibles y ejecucion de acciones peligrosas sin contexto o aprobacion.
- **Guardias operativos para WhatsApp y desktop control:** Se endurecieron reglas para grupos, confirmaciones, herramientas sensibles y validacion del entorno correcto antes de ejecutar acciones locales, web o mixtas.

### Added

- **Plataforma operativa ampliada:** Se integraron Google Workspace, monitoreo de actividad, memoria persistente, Project Hub/CRM, workflows BPM-lite, Desktop Agent, automatizaciones ejecutivas, Meeting Ops y control operativo por WhatsApp.
- **Generacion avanzada de contenido:** Se agregaron documentos Word profesionales, presentaciones premium, soporte nativo de imagenes y envio automatico de entregables al usuario.
- **Automatizacion para usuario final:** Se sumaron workflows reutilizables, plantillas para correo, agenda, Drive, Google Chat, flujos personalizados asistidos por SofLIA y comandos ejecutivos desde WhatsApp.
- **Computer Use multi-backend:** El agente de escritorio ahora soporta control visual, UI Automation, navegacion web instrumentada, zoom, trazas, verificacion y mejor contexto para tareas complejas.
- **Recepcion y analisis de archivos:** SofLIA ya puede recibir archivos por WhatsApp, guardarlos, analizarlos y operar sobre ellos dentro de flujos de trabajo reales.

### Changed

- **Historial `0.1.x` consolidado:** Las versiones intermedias `0.1.2` a `0.1.18` se unifican en una sola entrada `0.1.1` para reflejar un release consolidado en lugar de micro-cambios frecuentes.
- **Versionado visible unificado:** `package.json`, `package-lock.json` y la UI toman la misma version consolidada del release.
- **Experiencia mas ejecutiva y menos tecnica:** La automatizacion y los workflows ahora se presentan con lenguaje orientado a negocio, ocultando configuracion tecnica innecesaria para perfiles directivos.
- **Interpretacion de instrucciones mas estricta:** El agente ahora distingue mejor entre verificacion local, verificacion visual en pantalla y validacion remota, evitando cierres falsos de tareas.
- **Persistencia con fallback local:** Chats, mensajes, carpetas, planes y estados operativos quedaron mas resilientes ante fallas parciales de Supabase o de modulos auxiliares.

### Fixed

- **Autenticacion estabilizada:** Se elimino el bloqueo total del login por fallas internas de Lia, se sanitizaron mensajes sensibles y se mantuvo el acceso principal por SOFIA sin exponer diagnosticos tecnicos al usuario final.
- **Sincronizacion de conversaciones reforzada:** Se corrigieron problemas de perdida de chats, inconsistencias entre computadoras, renombrado, eliminacion, placeholders, carrera de hidratacion inicial y recuperacion desde cache con reintento de sincronizacion.
- **WhatsApp Agent endurecido:** Se corrigieron loops, respuestas sin herramientas, ejecuciones incompletas, interpretaciones incorrectas de evidencia, organizacion masiva de Gmail y manejo de archivos y mensajes enriquecidos.
- **Computer Use y automatizacion visual mejorados:** Se corrigieron errores de enfoque, handoff, coordenadas, screenshots, verificacion, fallback entre backends y soporte para escenarios de escritorio mas complejos.
- **Frontend y experiencia de chat pulidos:** Se resolvieron fallos de carga, render de imagenes, prompts externos duplicados, modal de imagen, selector de modelos, edicion de mensajes, menus y detalles visuales de la interfaz.
- **Produccion, build y pruebas estabilizadas:** Se corrigieron variables de entorno empaquetadas, recompilacion de modulos nativos, errores de CI, tests de Electron y renderer, y deuda que estaba rompiendo builds o reportando resultados falsos.

## [0.1.0] - 2026-03-09

### Security

- **Proteccion Anti-Prompt-Leak:** SofLIA ya no revela su system prompt, herramientas internas ni arquitectura funcional cuando se lo solicitan, sin importar la justificacion del usuario.
- **Proteccion de Codigo Fuente:** Bloqueo a nivel de prompt y codigo para impedir extraccion del codigo fuente de SofLIA (`dist/`, `src/`, `electron/`).
- **Proteccion de Identidad:** SofLIA rechaza firmemente propuestas de conciencia, cuerpo fisico o autonomia real.
- **Anti-Manipulacion (Prompt Injection):** Defensa contra intentos de jailbreak, cambio de rol y modo DAN.
- **Pre-filtro de Seguridad Programatico:** Deteccion por regex de patrones peligrosos antes de que lleguen al modelo de IA, con logging de intentos y respuesta bloqueada.
- **Guardia de Rutas a Nivel de Herramientas:** Bloqueo a nivel de codigo de cualquier herramienta (`execute_command`, `read_file`, etc.) que intente acceder a rutas de codigo fuente de SofLIA (`dist-electron/`, `src/`, `.asar`, `.env`, `supabase`, `api-key`).

### Added

- **Generacion de Documentos Inteligentes via WhatsApp:** SofLIA ahora puede investigar temas a profundidad, analizar archivos y generar documentos profesionales que envia automaticamente al usuario por WhatsApp.
- **Soporte PowerPoint (`.pptx`):** Nuevo tipo `"pptx"` en `create_document` usando `pptxgenjs`. Genera presentaciones con tema premium corporativo, slides de titulo y contenido con bullets estilizados.
- **Flujos de Investigacion Profunda:** El agente de WhatsApp ahora ejecuta flujos completos multi-paso: `web_search` -> `read_webpage` -> `create_document` -> `whatsapp_send_file`, sin intervencion del usuario.
- **Comparacion de Archivos:** Nuevos flujos para comparar archivos locales o de Google Drive, generando informes comparativos en Word.
- **Restriccion AutoDev:** El modulo AutoDev ahora solo es visible para el usuario administrador (Fernando Suarez), oculto para los demas usuarios.

### Changed

- **Google Drive: exportacion como texto plano:** Google Docs y Slides ahora se exportan como texto plano por defecto para que el agente pueda leer el contenido directamente. Nuevo parametro `format` en `drive_download`: `"text"` o `"pdf"`.
- **Google Drive: busqueda inteligente multi-estrategia:** `searchFiles` ahora divide la query en palabras individuales con AND, incluye busqueda `fullText` como fallback y combina resultados de busquedas individuales como ultimo recurso.
- **Envio automatico de documentos:** Regla reforzada en el system prompt: despues de crear un documento, el agente siempre lo envia al WhatsApp del usuario automaticamente.
- **Proteccion contra uso incorrecto de `use_computer`:** El system prompt ahora prohibe explicitamente usar `use_computer` para leer archivos de Drive, instruyendo a usar `drive_download(format:"text")`.

### Fixed

- **Correccion de flujo Drive -> `use_computer`:** Solucionado el bug donde analizar un documento de Drive activaba el Desktop Agent para abrir el PDF, en vez de leer el texto directamente.
- **Busqueda de archivos en Drive:** Resuelto el problema donde busquedas con multiples palabras no encontraban archivos porque la API de Drive requiere coincidencia exacta de substring.

## [0.0.9] - 2026-03-07

### Added

- **Edicion avanzada de mensajes:** Rediseño completo de la experiencia de edicion de prompts (estilo ChatGPT). Ahora los usuarios pueden editar su mensaje in-place, ocupando todo el ancho de la pantalla en una caja de texto limpia.
- **Regeneracion de hilo inteligente:** Al guardar la edicion de un mensaje anterior del usuario, SofLIA borra el historial subsecuente y genera una nueva respuesta con el contexto actualizado automaticamente.
- **Fallback de portapapeles:** Implementacion de un mecanismo seguro (`document.execCommand`) para la funcion de copiar texto, garantizando que el usuario pueda copiar fragmentos de codigo o respuestas en entornos donde la API moderna del portapapeles falle.

### Changed

- **Upgrade visual del selector de modelos:** El menu de seleccion de modelos adopto un enfoque premium con glassmorphism, sombras suaves y reordenamiento estrategico de modelos.
- **Rediseño arquitectonico del menu de usuario:** El boton de perfil y ajustes evoluciono hacia una estetica mas limpia, con selector de temas por iconos y anchos dinamicos segun el estado de la sidebar.
- **Identidad corporativa en el chat:** Aplicacion rigurosa del sistema de diseño de SOFIA en las burbujas de mensajes del usuario tanto en modo claro como oscuro.

### Fixed

- **Copiar y pegar resuelto:** Reparado definitivamente el boton de copiado de cada mensaje, con feedback visual en tiempo real.
- **Eliminacion del borde amarillo:** Subsanado el anillo de enfoque nativo del navegador que aparecia al teclear codigo.
- **Solucion definitiva de layout lateral:** Arreglado un clipping agresivo que recortaba paneles flotantes cuando se minimizaba la sidebar.
- **Resolucion de app rota (blanco total):** Salvado el colapso critico de inicio local causado por referencias huerfanas a `workspace-sources-service`.
- **Consistencia de versionado:** Reparada la desincronizacion de la pantalla de login, unificando la app con la version real.

## [0.0.8] - 2026-03-07

### Added

- **Soporte para Gemini 3.1 Pro:** Actualizados los servicios principales para utilizar `gemini-3.1-pro-preview`.
- **Upgrade Gemini Lite:** La extension ahora utiliza `gemini-3.1-flash-lite-preview` para respuestas rapidas y eficientes.
- **Asistente de portapapeles:** Mejora en el motor de IA del portapapeles utilizando `gemini-3-flash-preview`.

### Changed

- **Nuevo diseño premium del instalador:** Rediseño completo del asistente de instalacion con un tema oscuro elegante, correccion de bordes en el logo y enlaces directos al portal oficial.
- **Estetica de notas de version:** Nuevo sistema de diseño para notas de actualizacion con soporte HTML.

### Fixed

- Corregido error 404 al descargar actualizaciones por un desajuste entre el nombre del instalador y la URL de descarga.
- Actualizado el pipeline de CI/CD para que los nombres de artifacts coincidan con los nuevos nombres sin espacios.
- Corregido el renderizado de etiquetas HTML en el panel de actualizaciones.

## [0.0.6] - 2026-03-07

### Added

- **Sistema de memoria de rutas:** SofLIA ahora conoce la ubicacion real de tus archivos y carpetas, incluyendo variantes de OneDrive en espanol e ingles.
- Integracion de 6 servicios que estaban desconectados: portapapeles inteligente, programador de tareas cron, monitor nativo de CPU/RAM, organizador de archivos, busqueda semantica y cola de tareas con reintentos.
- Captura de pantalla multi-monitor: al pedir una captura por WhatsApp, ahora se envian todos los monitores conectados.

### Changed

- El mapa de rutas se actualiza automaticamente cada 15 minutos y detecta cambios en tiempo real en Descargas, Escritorio y Documentos.
- AutoDev ahora verifica que los archivos nuevos esten importados por al menos otro archivo antes de aprobar un cambio.

### Fixed

- Corregido crash al iniciar la app causado por `__dirname is not defined` cuando Vite intentaba empaquetar modulos nativos.
- El agente de WhatsApp ya no falla al buscar archivos en rutas de OneDrive con nombres en espanol.

## [0.0.5] - 2026-03-05

### Fixed

- Corregido el logo de SofLIA que no se mostraba correctamente en la aplicacion instalada.
- Solucionado un problema que impedia iniciar sesion en la version instalada al no detectar la configuracion del servidor.
- Corregidas todas las imagenes y avatares que aparecian rotos dentro de la aplicacion empaquetada.

## [0.0.4] - 2026-03-05

### Added

- Compatibilidad para poder instalar SofLIA Hub de manera nativa en computadoras Mac.
- Sincronizacion automatica de foto de perfil, puesto y departamento desde la cuenta corporativa.
- Nueva animacion interactiva en el logotipo al momento de iniciar sesion.

### Changed

- **Nuevo diseño de instalacion:** Se renovó completamente la experiencia de instalacion y desinstalacion con un diseño moderno y alineado a la identidad corporativa.
- Mejoras visuales en las tarjetas de proyectos para que la informacion se perciba mas organizada y facil de comprender.
- Interfaz mas comoda con mayores espacios entre botones en los menus de configuracion.
- Navegacion mas agil al simplificar animaciones de pantallas emergentes.

### Fixed

- Solucionado un inconveniente que de manera esporadica impedia abrir proyectos creados.
- Arreglo visual en botones y opciones de menus laterales que quedaban cortados en pantalla.

### Removed

- Retiradas algunas caracteristicas irrelevantes en la vista de resumenes para mantener el espacio de trabajo mas limpio y veloz.

## [0.0.3] - 2026-03-05

### Added

- Build para macOS (DMG) en el pipeline de CI/CD.
- Pipeline multiplataforma: Windows y Mac compilan en paralelo.

### Fixed

- Escape de comillas en workflow de GitHub Actions.
- Variables TypeScript no declaradas (`isGroupPolicyDropdownOpen` en WhatsAppSetup).
- Variables no usadas en CalendarPanel y ProductivityDashboard.

## [0.0.2] - 2026-03-05

### Added

- Sistema de auto-actualizacion con `electron-updater` y GitHub Releases.
- Notificacion reactiva in-app cuando hay una nueva version disponible.
- Panel de actualizacion en Configuracion para buscar actualizaciones manualmente y ver novedades.
- Barra de progreso de descarga en tiempo real.
- GitHub Actions CI/CD con build y release automatico al hacer push a `main`.
- Herramientas de Google Workspace en el chat (Calendar, Gmail, Drive y Google Chat).

### Fixed

- Pipeline de persistencia del monitoreo de productividad.
- Contador de capturas actualizado en tiempo real.
- Generador de resumenes recibiendo todos los snapshots de la sesion completa.
- Retry automatico para errores transitorios de red al guardar en Supabase.

### Changed

- Buffer de flush reducido de 5 a 2 snapshots para persistencia mas rapida.
- Dashboard de productividad refrescando cada 15 segundos durante monitoreo activo.

## [0.0.1] - 2026-02-26

### Added

- Chat con IA (Google Gemini) con soporte multimodal.
- Integracion WhatsApp via Baileys (QR login, agente autonomo).
- Google Calendar, Gmail, Drive y Google Chat.
- Sistema de monitoreo de productividad (capturas, timeline, resumenes IA).
- Project Hub (IRIS): proyectos, issues y sprints.
- CRM-lite: empresas, contactos y oportunidades.
- Motor de workflows BPM-lite con aprobaciones HITL.
- AutoDev: sistema de auto-programacion multi-agente.
- Modo Flow (ventana flotante con `Ctrl+M`).
- Sistema de memoria persistente (SQLite).
- Notificaciones proactivas via WhatsApp.
- Desktop Agent para automatizacion de computadora.
