# Changelog

Todos los cambios notables de SofLIA Hub se documentan aqui.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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
