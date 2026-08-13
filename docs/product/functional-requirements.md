# Requisitos funcionales

Estado: vigente. Actualizado: 2026-08-06.

Cada requisito usa lenguaje observable. La matriz de cobertura se encuentra en
[trazabilidad](traceability-matrix.md).

<!-- evidence: src/app/AppContent.tsx -->
<!-- evidence: electron/main/startup.ts -->
<!-- evidence: electron/preload/channels.ts -->

<!-- define: RF-001 -->
<!-- define: RF-002 -->
<!-- define: RF-003 -->
<!-- define: RF-004 -->
<!-- define: RF-005 -->
<!-- define: RF-006 -->
<!-- define: RF-007 -->
<!-- define: RF-008 -->
<!-- define: RF-009 -->
<!-- define: RF-010 -->
<!-- define: RF-011 -->
<!-- define: RF-012 -->
<!-- define: RF-013 -->
<!-- define: RF-014 -->
<!-- define: RF-015 -->
<!-- define: RF-016 -->
<!-- define: RF-017 -->
<!-- define: RF-018 -->
<!-- define: RF-019 -->
<!-- define: RF-020 -->
<!-- define: RF-021 -->
<!-- define: RF-022 -->
<!-- define: RF-023 -->
<!-- define: RF-024 -->
<!-- define: RF-025 -->
<!-- define: RF-026 -->
<!-- define: RF-027 -->
<!-- define: RF-028 -->
<!-- define: RF-029 -->
<!-- define: RF-030 -->
<!-- define: RF-031 -->
<!-- define: RF-032 -->
<!-- define: RF-033 -->
<!-- define: RF-034 -->
<!-- define: RF-035 -->
<!-- define: RF-036 -->
<!-- define: RF-037 -->
<!-- define: RF-038 -->
<!-- define: RF-039 -->
<!-- define: RF-040 -->
<!-- define: RF-041 -->

## Identidad, contexto y navegacion

| ID | El sistema debe... | Resultado verificable | Evidencia |
|---|---|---|---|
| RF-001 | autenticar únicamente con SOFIA y resolver automáticamente la sesión operativa de conversaciones | un usuario válido entra al workspace sin otra credencial; un fallo secundario conserva SOFIA, muestra un estado simple y permite reintentar | `src/contexts/auth/`, `src/services/lia-session-exchange.ts`, `database/lia/supabase/functions/sofia-session-exchange/`, `src/app/ChatUnavailableState.tsx` |
| RF-002 | cargar organizaciones, membresias y equipos y permitir cambiar la organizacion activa | sidebar, IRIS y shares cambian al scope seleccionado | `src/contexts/auth/useSofiaSelection.ts`, `src/app/AppContent.tsx` |
| RF-003 | mantener conversaciones y mensajes con carga, creacion, renombrado, pin, eliminacion y recuperacion de pendientes | la lista y el chat remoto/local convergen despues de reintentos | `src/services/chat/`, `src/hooks/chat-manager/` |
| RF-004 | crear, renombrar y eliminar carpetas y mover conversaciones entre ellas | el Project Hub refleja el agrupamiento persistido | `src/services/folder/`, `src/hooks/folder-manager/` |
| RF-005 | compartir conversaciones/carpetas con miembros o enlaces y permitir revocar acceso | el receptor solo ve targets accesibles y el owner puede revocar | `src/services/share/`, `src/components/share-modal/` |
| RF-006 | mostrar equipos, proyectos e issues IRIS del scope de organizacion y abrir su contexto en chat/proyecto | una seleccion IRIS produce la vista/contexto correspondiente | `src/hooks/useIrisData.ts`, `src/services/iris-data/` |

## Asistencia, archivos y productividad

| ID | El sistema debe... | Resultado verificable | Evidencia |
|---|---|---|---|
| RF-007 | enviar mensajes al proveedor de IA, transmitir texto incremental y despachar herramientas declaradas | el usuario recibe stream, resultados o error publico acotado | `src/services/gemini-chat/` |
| RF-008 | ofrecer operaciones locales gobernadas de archivos, documentos, procesos, portapapeles, URLs y correo SMTP | cada llamada cruza handler main y pide confirmacion cuando corresponde | `electron/computer-use-handlers.ts`, `electron/computer-use/` |
| RF-009 | iniciar/detener sesiones de monitoreo y capturar ventana, proceso, idle, screenshot/OCR segun config | status y snapshots reflejan la sesion activa | `electron/monitoring/`, `src/services/monitoring/` |
| RF-010 | generar y persistir resumen de productividad y poder enviarlo por WhatsApp | el usuario obtiene metricas/resumen para el periodo disponible | `electron/summary-generator.ts`, `src/components/productivity-dashboard/` |

## Workspace y canales

| ID | El sistema debe... | Resultado verificable | Evidencia |
|---|---|---|---|
| RF-011 | conectar Google/Microsoft Calendar y listar/crear/actualizar/eliminar eventos | conexiones y eventos se actualizan por IPC | `electron/calendar/`, `electron/calendar-handlers.ts` |
| RF-012 | enviar, leer, etiquetar, organizar, enviar a papelera y operar por lotes en Gmail | operaciones devuelven `{ success, error?, data }` sin exponer tokens | `electron/gmail/`, `electron/gmail-handlers.ts` |
| RF-013 | listar, buscar, subir, descargar, crear carpetas y eliminar en Drive | el renderer recibe metadata o archivo autorizado | `electron/drive/`, `electron/drive-handlers.ts` |
| RF-014 | listar espacios/mensajes, enviar, reaccionar y consultar miembros en Google Chat | la accion usa el auth compartido de Calendar | `electron/gchat/`, `electron/gchat-handlers.ts` |
| RF-015 | conectar/desconectar WhatsApp, mostrar QR/estado y editar acceso, grupos y personalizacion | ajustes y estado reflejan la configuracion persistida | `electron/whatsapp/`, `src/components/whatsapp-setup/` |
| RF-016 | procesar mensajes WhatsApp con audio/media, memoria, loop de herramientas y respuesta | el remitente autorizado recibe respuesta o denegacion explicita | `electron/wa-agent/`, `electron/whatsapp-audio-processor.ts` |
| RF-017 | configurar Telegram, probar conexion, listar chats y enviar mensajes | el canal reporta disponibilidad y resultado | `electron/telegram/`, `src/services/telegram-service.ts` |
| RF-018 | unificar principals, capabilities, politicas, historial y mensajes programados de canales | cada request se autoriza por provider, scope, rol y capability | `electron/communication-hub/` |

## Reuniones y decisiones

| ID | El sistema debe... | Resultado verificable | Evidencia |
|---|---|---|---|
| RF-019 | crear runs de reunion manuales o desde Drive y asociar fuentes/artefactos | el run persiste estado y fuentes | `electron/meetings/meeting-workflow-service.ts`, `database/lia/migrations/meeting-ops-tables.sql` |
| RF-020 | capturar/transcribir una reunion en vivo mediante sidecar, segmentos y deteccion | status/eventos IPC reflejan start, segmentos, stop y error | `electron/meeting-live/`, `electron/meeting-live-handlers.ts` |
| RF-021 | presentar assets/acciones para aprobar, rechazar o editar con identidad del decisor | la decision cambia estado y queda persistida | `electron/meetings/meeting-review-service.ts`, `src/components/meetings/` |
| RF-022 | sincronizar acciones aprobadas y consultar follow-ups/contexto | solo acciones elegibles generan sync actions | `electron/meetings/meeting-sync-service.ts` |

## Memoria, agentes y automatizacion

| ID | El sistema debe... | Resultado verificable | Evidencia |
|---|---|---|---|
| RF-023 | registrar turnos y recuperar contexto por resumen, similitud, hechos y skills | la respuesta usa solo memoria del owner y respeta presupuestos | `electron/memory/` |
| RF-024 | extraer, guardar, buscar y ejecutar skills aprendidas con template permitido | la ejecucion usa `WorkspaceAutomationService`, no Markdown arbitrario | `electron/memory/skills-executable.ts`, `electron/main/startup.ts` |
| RF-025 | ejecutar/abortar tareas Desktop Agent, seleccionar backend, capturar pantalla y reportar estado | tarea, pasos, backend y resultado son observables | `electron/desktop-agent/`, `electron/desktop-agent-handlers.ts` |
| RF-037 | ofrecer un navegador integrado con chat u Orbe flotante, pestañas, sesión e historial persistentes, favoritos locales, credenciales cifradas y extensiones compatibles que usuario y agente puedan observar sobre la misma página | hasta 500 pestañas lógicas comparten la sesión con máximo 8 vistas vivas y suspensión LRU; hasta cuatro pestañas pueden moverse a ventanas nativas separadas sin recarga y dentro del mismo presupuesto; popups HTTP(S) quedan internos; dos pestañas pueden verse divididas o superpuestas y el foco define el objetivo del agente; el chat compacto permite cambiar modelo/razonamiento y crear, buscar o activar conversaciones mediante popovers accesibles, se alinea bajo la barra, se mueve, redimensiona, minimiza o cambia por la Orbe general; el modelo seleccionado conserva la orquestación, puede combinar DOM, búsqueda web, navegación determinista, Computer Use browser y Computer Use desktop con superficie explícita, mientras Gemini 3.6 Flash actúa solo como actuador; los envíos y efectos irreversibles requieren HITL; main conserva solo la última captura + DOM saneado, no fuerza observación en turnos ajenos al navegador y usa captura pasiva de máximo 1024 px con cadencia base 10/4 segundos y perfil YouTube 30/12 segundos; redirecciones de subframes OAuth/2FA no generan errores globales, pero protocolos no permitidos del frame principal se bloquean; valores de formularios, contenido editable, contraseñas, secretos y rutas no salen de main; extensiones muestran permisos completos, requieren aprobación explícita y permiten reintento; las acciones sobre el texto seleccionado —preguntar a SofLIA, mejorar la redacción, traducir, resumir y abrir en modo lectura— se ofrecen en el menú contextual y en un menú flotante que aparece junto a la selección al terminarla, se apaga mientras el agente conduce el navegador y nunca envía el turno por su cuenta; el modo lectura se abre por selección, menú contextual, menú flotante o control visible, mantiene visible el documento original con imágenes y gráficas, muestra una cápsula flotante movible dentro del viewport sin reservar espacio, genera audio ElevenLabs solo por gesto explícito mediante un microlote inicial y hasta dos lotes posteriores anticipados con timeout recuperable, prepara pronunciación española y contexto entre lotes con offsets reversibles, extrae Google Docs mediante la sesión autenticada o el árbol de accesibilidad sin narrar su interfaz, subraya temporalmente el rango DOM fiable o el token sincronizado en la cápsula cuando el documento usa lienzo virtual, y ofrece reproducción, detención y reducción/aumento de velocidad sin persistir ni descargar audio | `electron/integrated-browser/`, `electron/desktop-agent/task-entrypoint.ts`, `electron/desktop-agent/task-budget.ts`, `src/components/browser/BrowserWorkspaceLayout.tsx`, `src/components/browser/BrowserConversationMenu.tsx`, `src/components/browser/IntegratedBrowserPanel.tsx`, `src/services/gemini-chat/browser-grounding-intent.ts`, `src/services/gemini-chat/send-message-stream.ts`, `src/services/gemini-chat/integrated-browser-tools.ts` |
| RF-038 | ofrecer un catalogo unico de Skills del sistema y del usuario, configurable desde los ajustes (nombre, comando de invocacion, icono, instrucciones y prompts de inicio) e invocable con el comando `/nombre` desde el compositor del chat completo y del chat flotante del navegador, y con el mismo contrato en WhatsApp | la clase se deriva de la fuente y una fila de la base de datos nunca se presenta como Skill del sistema; el comando lo elige el usuario o se deriva de su nombre, y dos skills del mismo usuario no pueden compartirlo; el icono se guarda como identificador de un catalogo cerrado, no como glifo; una Skill del usuario no habilita herramientas; una Skill solo activa lo que su superficie ya permite; las herramientas de workspace solo se declaran con workspace vivo; en WhatsApp se respetan superficie y bloqueo en grupos | `src/shared/skills/`, `src/services/skills/`, `electron/wa-agent/chat-commands/skills.ts`, `database/lia/migrations/skills-registry.sql` |
| RF-039 | generar presentaciones ejecutivas en HTML y CSS con la identidad de la organizacion, recolectando y confirmando la informacion antes de generar, mostrando el proceso y permitiendo iterar por conversacion | la skill no genera al activarse: resume y confirma el contenido previo, lee la pagina abierta del navegador, o pregunta tema, destinatario y origen (Drive, archivo local o investigacion) y, si investiga, valida un esquema de diapositivas antes de escribir; la paleta sale del logo real de la organizacion cuando esta no configuro colores propios, con contraste garantizado sobre el fondo; los archivos se escriben en una carpeta por presentacion asociada a la conversacion; main escribe las variables de marca antes de que el modelo empiece y el modelo no puede reescribirlas; la presentacion renderiza sin conexion y no alcanza IPC, `node` ni la red; el panel muestra el archivo en curso y habilita reproducir solo cuando existe el documento de entrada; ocultar el panel no cancela la generacion y se recupera desde el menu de herramientas; un cambio acotado edita por reemplazo exacto en vez de regenerar; se exporta a PDF y, en WhatsApp, se entrega el archivo tras aprobacion explicita, sin ningun generador de terceros | `src/shared/skills/presentaciones-skill.ts`, `src/prompts/skills/presentaciones.ts`, `electron/skill-workspace/`, `electron/organization-branding/`, `src/components/presentation/`, `electron/presentation-workflow/` |
| RF-040 | permitir que el usuario adjunte al chat el contenido de las aplicaciones que ya tiene abiertas en su equipo, con la misma ergonomia del selector de pestanas | abrir el selector lista las ventanas con miniatura y aplicacion de origen sin leer el contenido de ninguna, excluye las ventanas de Pulse Hub y las ventanas sin titulo; marcar una aplicacion dispara su lectura y el chip declara la fidelidad real antes de enviar; la extraccion baja por la primera via util (documento de Office resuelto por COM y leido por el sidecar, texto de la ventana por UI Automation, captura de la ventana) y degrada sola al fallar o agotar su presupuesto; COM solo consulta ruta y estado de guardado y nunca modifica el documento; un archivo con cambios sin guardar se marca como desactualizado en el chip y en el contexto; una captura se declara como tal y limita las afirmaciones a lo visible; nada se captura sin seleccion explicita, no hay observacion continua ni persistencia del contenido; los limites por aplicacion y por turno se comparten con las pestanas y el recorte se declara; fuera de Windows solo hay captura y la respuesta lo declara; SOFLIA_DISABLE_DESKTOP_CONTEXT=1 no registra los canales y oculta la entrada del menu | `electron/desktop-context/`, `electron/desktop-context-handlers.ts`, `src/services/desktop-context-service.ts`, `src/adapters/desktop_ui/chat-ui/app-attachments.ts`, `src/adapters/desktop_ui/chat-ui/input/AppAttachmentPicker.tsx`, `src/adapters/desktop_ui/chat-ui/input/AppAttachmentChips.tsx` |
| RF-041 | permitir borrar los datos que el navegador integrado acumulo en el perfil del usuario, con el alcance de un navegador de escritorio | el panel ofrece historial, cookies y datos de sitios, archivos en cache, contrasenas guardadas y permisos por sitio, y nunca marcadores ni extensiones; el intervalo de tiempo se aplica exacto al historial y las demas categorias se borran completas declarandolo antes y despues, porque Electron no expone el rango temporal de Chromium; borrar exige confirmacion explicita que declara categorias e intervalo; el borrado se acota a la particion y los archivos del perfil con sesion activa y no toca el de otra cuenta; las pestanas abiertas no se cierran ni recargan; el resumen informa por categoria cuantos elementos se quitaron, si se ignoro el intervalo y que fallo; una categoria que falla no impide borrar las demas; el canal valida categorias e intervalo y rechaza otro emisor; la operacion no aparece en el catalogo de herramientas de ningun agente runtime | `electron/integrated-browser/browsing-data.ts`, `electron/integrated-browser/service.ts`, `electron/integrated-browser-handlers.ts`, `src/services/integrated-browser-service.ts`, `src/components/browser/BrowserPrivacyPanel.tsx`, `src/components/browser/BrowserManagementPanel.tsx` |
| RF-026 | iniciar, listar, consultar y terminar procesos de fondo con session ID | el proceso no bloquea IPC y puede ser cancelado | `electron/background-process/`, `electron/computer-use/background-process-tools.ts` |
| RF-027 | registrar nodos remotos y ejecutar aplicaciones, procesos, tareas o screenshots en ellos | el nodo se autoriza y reporta estado/resultados | `electron/remote-node/`, `electron/remote-node-handlers.ts` |
| RF-028 | descubrir, validar, recargar y ejecutar herramientas dinamicas gobernadas | plugins invalidos no se declaran ni ejecutan | `electron/mcp-manager/`, `electron/dynamic-tool/` |
| RF-029 | detectar wake word, administrar modelos/microfono y transcribir voz local | el sidecar reporta status y eventos; wake abre la orbe | `electron/python-runtime-service.ts`, `electron/voice-passive-handlers.ts` |
| RF-030 | parsear documentos y redactar texto sensible en un sidecar separado | un fallo documental no tumba el proceso de voz | `electron/python-tools-service.ts`, `python/tools_sidecar/` |
| RF-031 | consultar, descargar e instalar actualizaciones y mostrar progreso/notas sanitizadas | UI refleja `available`, progreso, descargada o error | `electron/updater/`, `src/components/update-notification/` |
| RF-032 | listar/ejecutar plantillas, aprobar runs y administrar casos del Workflow Hub | cada run/case expone estado, detalle y decisiones | `electron/workspace-automation/`, `electron/workflow-hub/` |
| RF-033 | consultar calendario/deadlines y emitir alertas proactivas configurables | trigger manual/poll produce alerta solo si esta habilitado | `electron/proactive/`, `electron/proactive-service.ts` |
| RF-034 | abrir una ventana orbe flotante con dictado, TTS, hide/wake y estado conversacional | la ventana independiente consume APIs `orb:*`; las respuestas se sintetizan con la voz `ELEVENLABS_VOICE_ID` y `eleven_turbo_v2_5` por defecto desde main, se reproducen en orden y mantienen texto/error visible si falta configuración o permiso | `electron/main/orb-window-controller.ts`, `electron/elevenlabs-tts.ts`, `electron/orb-tts.ts`, `src/components/orb/` |
| RF-035 | aceptar protocolo `soflia:` para enlaces compartidos y triggers de reunion | el comando se parsea antes del bootstrap y se entrega a la ventana | `electron/app-protocol.ts`, `electron/main/bootstrap.ts` |
| RF-036 | persistir ajustes de IA, memoria, canales, voz, privacidad, conexiones, productividad, meetings y updates | once tabs muestran/cambian solo sus dominios | `src/components/unified-settings/settings-tabs.tsx`, `src/services/settings/` |

## Manejo transversal de errores

Todo requisito que cruza IPC debe devolver una forma de error serializable y no
propagar objetos Electron, callbacks ni secretos al renderer. Las capacidades
opcionales deben degradarse con status/diagnostico; una denegacion de permisos no
se reintenta como fallo transitorio.
