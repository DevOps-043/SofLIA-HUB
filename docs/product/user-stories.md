# Historias de usuario

Estado: vigente. Actualizado: 2026-08-06.

Las historias reflejan rutas implementadas; no son un backlog aspiracional. La
aceptacion completa tambien exige las reglas y RNF enlazados.

<!-- evidence: src/app/AppWorkspace.tsx -->
<!-- evidence: src/components/unified-settings/settings-tabs.tsx -->
<!-- evidence: electron/main/service-factory.ts -->

<!-- define: HU-001 -->
<!-- define: HU-002 -->
<!-- define: HU-003 -->
<!-- define: HU-004 -->
<!-- define: HU-005 -->
<!-- define: HU-006 -->
<!-- define: HU-007 -->
<!-- define: HU-008 -->
<!-- define: HU-009 -->
<!-- define: HU-010 -->
<!-- define: HU-011 -->
<!-- define: HU-012 -->
<!-- define: HU-013 -->
<!-- define: HU-014 -->
<!-- define: HU-015 -->
<!-- define: HU-016 -->
<!-- define: HU-017 -->
<!-- define: HU-018 -->
<!-- define: HU-019 -->
<!-- define: HU-020 -->
<!-- define: HU-021 -->
<!-- define: HU-022 -->
<!-- define: HU-023 -->
<!-- define: HU-024 -->
<!-- define: HU-025 -->
<!-- define: HU-026 -->
<!-- define: HU-027 -->

| ID | Historia | Criterios de aceptacion implementados | Requisitos |
|---|---|---|---|
| HU-001 | Como usuario SOFIA, quiero iniciar sesion y conservar mi organizacion para trabajar en el contexto correcto. | Sesion persistida; organizaciones/equipos cargados; cambio de organizacion resegmenta IRIS; fallo Lia se informa como degradado. | RF-001, RF-002; BR-002, BR-003, BR-004 |
| HU-002 | Como usuario, quiero crear y retomar chats sin perder mensajes ante una sincronizacion parcial. | Crear/cargar/renombrar/pin/eliminar; cola local pendiente; recovery y refresh remoto. | RF-003; RNF-008 |
| HU-003 | Como usuario, quiero agrupar chats y fuentes por proyecto. | Crear/renombrar/eliminar carpeta; mover chat; abrir Project Hub; agregar fuente local o Drive. | RF-004, RF-006 |
| HU-004 | Como owner de contenido, quiero compartir una conversacion o carpeta y revocar acceso. | El boton solo aparece si es compartible; miembros/enlace se crean; acceso se valida; revocacion elimina el grant. | RF-005; BR-005 |
| HU-005 | Como usuario, quiero pedir a la IA que investigue o ejecute herramientas y recibir progreso comprensible. | Stream visible; tool results vuelven al loop; timeout/rate limit se traducen a mensaje publico; herramientas criticas confirman. | RF-007, RF-008; BR-009 |
| HU-006 | Como colaborador, quiero abrir proyectos/issues IRIS desde la barra lateral y continuar la conversacion con ese contexto. | Solo equipos del org activo; proyectos/issues cargados; seleccion abre proyecto o genera contexto. | RF-006; BR-003 |
| HU-007 | Como usuario, quiero medir mi actividad laboral sin registrar periodos idle como trabajo activo. | Inicio/stop; umbral idle; captura configurable; status y resumen del periodo. | RF-009, RF-010; BR-013, BR-014 |
| HU-008 | Como usuario, quiero conectar mis calendarios y administrar eventos desde el Hub. | OAuth Google/Microsoft; lista de conexiones/eventos; CRUD; start/stop auto; refresh de token. | RF-011 |
| HU-009 | Como usuario, quiero operar Gmail, Drive y Chat sin autenticar cada modulo por separado. | Servicios comparten auth Calendar; operaciones muestran error seguro; desconexion invalida acceso. | RF-012, RF-013, RF-014; BR-019 |
| HU-010 | Como operador, quiero conectar WhatsApp con QR y restringir quien usa el agente. | Estado/QR; allowlist personal; politica y allowlist de grupos; personalizacion; persistencia. | RF-015; BR-006, BR-007 |
| HU-011 | Como contacto WhatsApp autorizado, quiero conversar por texto/audio y usar capacidades seguras. | Audio se transcribe; memoria por owner; loop limitado; herramientas de grupo filtradas; respuesta o denegacion. | RF-016; BR-008, BR-015 |
| HU-012 | Como owner de organizacion, quiero unificar WhatsApp y Telegram bajo politicas auditables. | Principal resuelto; capabilities por rol/scope; conexiones; historial; programacion; evento de auditoria. | RF-017, RF-018; BR-024, BR-025 |
| HU-013 | Como facilitador, quiero crear una reunion desde archivo, Drive o captura en vivo y obtener una minuta propuesta. | Run con fuente; extraccion/transcripcion; assets generados; estados y errores visibles. | RF-019, RF-020 |
| HU-014 | Como aprobador, quiero revisar, editar y aprobar minuta y acciones antes de sincronizarlas. | Identidad del decisor; reject/approve; solo aprobadas pasan a sync; follow-ups consultables. | RF-021, RF-022; BR-012 |
| HU-015 | Como usuario recurrente, quiero que SofLIA recuerde hechos, preferencias y procedimientos utiles sin mezclar identidades. | Turnos, resumen, busqueda, facts y skills por owner; borrar fact/skill; presupuesto de contexto. | RF-023, RF-024; BR-015 |
| HU-016 | Como usuario, quiero delegar una tarea visual y poder abortarla si se desvía. | Backend auto/browser/desktop/UIA; status de pasos; una tarea visual; cola; abort; max steps. | RF-025; BR-017, BR-018 |
| HU-017 | Como operador tecnico, quiero lanzar procesos largos sin bloquear la app y revisar su salida. | Session ID; list/poll/kill; limites de salida y timeout; status independiente. | RF-026; RNF-009 |
| HU-018 | Como operador, quiero registrar otro equipo como nodo y ejecutar alli una tarea autorizada. | Alta/baja/test; estado; app/comando/tarea/screenshot; capability `remote_nodes`. | RF-027; BR-024 |
| HU-019 | Como administrador de integraciones, quiero instalar tools dinamicas sin convertir cualquier archivo en permiso. | Loader valida contrato; lista/doctor; hot reload; HITL/grupo/timeout/auditoria central. | RF-028; BR-010, BR-011, BR-027 |
| HU-020 | Como usuario, quiero invocar la orbe por voz y continuar mediante dictado/TTS. | Wake word abre orbe; mic/model status; parciales/final; voz ElevenLabs configurada en main; bloques MP3 ordenados; stop/hide; texto y errores visibles. | RF-029, RF-034 |
| HU-021 | Como usuario preocupado por privacidad, quiero parsear documentos y redactar texto en un proceso aislado. | Sidecar de tools separado; status; parse/redact; config privacidad; timeout/restart. | RF-030; RNF-005 |
| HU-022 | Como usuario, quiero conocer y aplicar actualizaciones sin descargar ejecutables manualmente. | Check; notas sanitizadas; progreso; descarga; instalacion explicita; errores. | RF-031; BR-020, BR-021 |
| HU-023 | Como owner, quiero automatizar tareas recurrentes conservando aprobacion y trazabilidad. | Templates/runs/cases; approve/reject; reglas pasivas; alertas proactivas; estados y auditoria. | RF-032, RF-033; BR-009 |
| HU-024 | Como usuario, quiero conversar con SofLIA mientras navego, retomar las acciones web del agente y consumir documentos en un lector accesible. | Hasta 500 pestañas lógicas con ocho vistas vivas y restauración LRU; hasta cuatro ventanas nativas separadas; foco explícito; chat compacto premium; el modelo visible orquesta y puede alternar DOM, Computer Use browser y Computer Use desktop sin cambiar silenciosamente de superficie; un flujo puede observar Codex, elaborar un resumen y volver a Google Chat, pero enviar exige HITL; la percepción pasiva no se fuerza en turnos ajenos al navegador y usa un perfil 30/12 segundos en YouTube para no competir con transcripciones; Gemini 3.6 Flash actúa sólo cuando hace falta actuación visual; OAuth/2FA conserva el frame principal gobernado; navegador vivo sin fallback externo; contraseñas cifradas por origen; extensiones MV3 con permisos visibles, aprobación y reintento; modo lectura por selección/documento con cápsula flotante y movible que conserva imágenes, gráficas y viewport, narración explícita por microlotes con dos anticipados y timeout recuperable, pronunciación española de marca/decimales, extracción autenticada o accesible de Google Docs sin leer su interfaz, subrayado temporal sobre rangos DOM fiables o seguimiento del token en la cápsula para lienzos virtuales, y botones para reducir/aumentar velocidad, sin descarga de audio. | RF-037; BR-009, BR-017, BR-018 |
| HU-025 | Como usuario, quiero pedirle a SofLIA una presentacion ejecutiva con la identidad de mi organizacion y ver como la construye. | Catalogo unico de Skills del sistema y propias, invocable en chat y WhatsApp; las del sistema no se editan y las del usuario no habilitan herramientas; la presentacion se arma desde un archivo, un documento de Drive, la pagina abierta en el navegador o mis indicaciones; los colores, tipografia y logo salen de mi organizacion y, si no tiene branding, se avisa y se usa el tema neutro; el panel derecho muestra en vivo el archivo que se escribe, permite reproducir la presentacion embebida o a pantalla completa, exportar a PDF y abrir la carpeta; puedo ocultarlo sin detener el trabajo y recuperarlo desde el menu de herramientas; pedir un cambio acotado edita solo esa parte; por WhatsApp recibo el PDF tras aprobarlo y nada se envia a un generador externo. | RF-038, RF-039; BR-009 |
| HU-026 | Como usuario, quiero adjuntar al chat lo que ya tengo abierto en mi computador (Word, Excel, PowerPoint u otra aplicacion) sin copiarlo a mano. | El selector lista mis ventanas abiertas con miniatura y aplicacion, sin leer ninguna hasta que marco una; las ventanas de Pulse Hub no aparecen; al marcar veo en el chip con que fidelidad se leyo antes de enviar; un documento de Office llega completo y con sus tablas, otra aplicacion llega como texto de la ventana y, si no expone nada, llega como captura declarada como tal; si el archivo tiene cambios sin guardar se me advierte; puedo desmarcar y quitar adjuntos; si una aplicacion falla o tarda demasiado, se avisa y el resto del mensaje se envia igual; nada se captura sin que yo lo marque y nada se guarda. | RF-040 |
| HU-027 | Como usuario, quiero borrar cookies, cache e historial del navegador de SofLIA como lo hago en Chrome. | Elijo que borrar entre historial, cookies y datos de sitios, cache, contrasenas guardadas y permisos por sitio; mis marcadores y extensiones no se tocan; elijo un intervalo y se me dice con claridad que solo el historial lo respeta y que cookies y cache se borran completas; nada se borra hasta que confirmo, y la confirmacion me dice que voy a borrar; al terminar veo cuanto se quito de cada cosa y que fallo si algo fallo; borro lo mio y el perfil de otra cuenta del equipo queda intacto; mis pestanas siguen abiertas donde estaban. | RF-041; BR-009 |

## Cobertura de excepciones

Para todas las historias: usuario no autenticado, integracion no configurada,
permiso denegado, timeout, desconexion, respuesta parcial, cancelacion y payload
invalido deben terminar en estado seguro y visible, no en ejecucion silenciosa.
