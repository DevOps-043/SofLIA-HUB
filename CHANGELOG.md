# Changelog

Todos los cambios notables de SofLIA Hub se documentan aqui.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
