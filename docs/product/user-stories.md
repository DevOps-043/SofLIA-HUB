# Historias de usuario

Estado: vigente. Actualizado: 2026-08-04.

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

| ID | Historia | Criterios de aceptacion implementados | Requisitos |
|---|---|---|---|
| HU-001 | Como usuario SOFIA, quiero iniciar sesion y conservar mi organizacion para trabajar en el contexto correcto. | Sesion persistida; organizaciones/equipos cargados; cambio de organizacion resegmenta IRIS; fallo Lia se informa como degradado. | RF-001, RF-002; BR-002, BR-003, BR-004 |
| HU-002 | Como usuario, quiero crear y retomar chats sin perder mensajes ante una sincronizacion parcial. | Crear/cargar/renombrar/pin/eliminar; cola local pendiente; recovery y refresh remoto. | RF-003; RNF-008 |
| HU-003 | Como usuario, quiero agrupar chats y fuentes por proyecto. | Crear/renombrar/eliminar carpeta; mover chat; abrir Project Hub; agregar fuente local o Drive. | RF-004, RF-006 |
| HU-004 | Como owner de contenido, quiero compartir una conversacion o carpeta y revocar acceso. | El boton solo aparece si es compartible; miembros/enlace se crean; acceso se valida; revocacion elimina el grant. | RF-005; BR-005 |
| HU-005 | Como usuario, quiero pedir a la IA que investigue o ejecute herramientas y recibir progreso comprensible. | Stream visible; tool results vuelven al loop; timeout/rate limit se traducen a mensaje publico; herramientas criticas confirman. | RF-007, RF-008; BR-009 |
| HU-006 | Como colaborador, quiero abrir proyectos/issues IRIS desde la barra lateral y continuar la conversacion con ese contexto. | Solo equipos del org activo; proyectos/issues cargados; seleccion abre proyecto o genera contexto. | RF-006; BR-003 |
| HU-007 | Como usuario, quiero medir mi actividad laboral sin registrar periodos idle como trabajo activo. | Inicio/stop; umbral idle; captura configurable; status y resumen del periodo. | RF-009, RF-010; BR-014, BR-015 |
| HU-008 | Como usuario, quiero conectar mis calendarios y administrar eventos desde el Hub. | OAuth Google/Microsoft; lista de conexiones/eventos; CRUD; start/stop auto; refresh de token. | RF-011 |
| HU-009 | Como usuario, quiero operar Gmail, Drive y Chat sin autenticar cada modulo por separado. | Servicios comparten auth Calendar; operaciones muestran error seguro; desconexion invalida acceso. | RF-012, RF-013, RF-014; BR-020 |
| HU-010 | Como operador, quiero conectar WhatsApp con QR y restringir quien usa el agente. | Estado/QR; allowlist personal; politica y allowlist de grupos; personalizacion; persistencia. | RF-015; BR-006, BR-007 |
| HU-011 | Como contacto WhatsApp autorizado, quiero conversar por texto/audio y usar capacidades seguras. | Audio se transcribe; memoria por owner; loop limitado; herramientas de grupo filtradas; respuesta o denegacion. | RF-016; BR-008, BR-016 |
| HU-012 | Como owner de organizacion, quiero unificar WhatsApp y Telegram bajo politicas auditables. | Principal resuelto; capabilities por rol/scope; conexiones; historial; programacion; evento de auditoria. | RF-017, RF-018; BR-025, BR-026 |
| HU-013 | Como facilitador, quiero crear una reunion desde archivo, Drive o captura en vivo y obtener una minuta propuesta. | Run con fuente; extraccion/transcripcion; assets generados; estados y errores visibles. | RF-019, RF-020 |
| HU-014 | Como aprobador, quiero revisar, editar y aprobar minuta y acciones antes de sincronizarlas. | Identidad del decisor; reject/approve; solo aprobadas pasan a sync; follow-ups consultables. | RF-021, RF-022; BR-012 |
| HU-015 | Como responsable operativo, quiero registrar decisiones con evidencia, acciones y auditoria inmutable. | CRUD permitido por estado; aprobacion/rechazo; audit append-only; contexto y vigencia. | RF-023, RF-024; BR-013 |
| HU-016 | Como usuario recurrente, quiero que Pulse recuerde hechos, preferencias y procedimientos utiles sin mezclar identidades. | Turnos, resumen, busqueda, facts y skills por owner; borrar fact/skill; presupuesto de contexto. | RF-025, RF-026; BR-016 |
| HU-017 | Como usuario, quiero delegar una tarea visual y poder abortarla si se desvía. | Backend auto/browser/desktop/UIA; status de pasos; una tarea visual; cola; abort; max steps. | RF-027; BR-018, BR-019 |
| HU-018 | Como operador tecnico, quiero lanzar procesos largos sin bloquear la app y revisar su salida. | Session ID; list/poll/kill; limites de salida y timeout; status independiente. | RF-028; RNF-009 |
| HU-019 | Como operador, quiero registrar otro equipo como nodo y ejecutar alli una tarea autorizada. | Alta/baja/test; estado; app/comando/tarea/screenshot; capability `remote_nodes`. | RF-029; BR-025 |
| HU-020 | Como administrador de integraciones, quiero instalar tools dinamicas sin convertir cualquier archivo en permiso. | Loader valida contrato; lista/doctor; hot reload; HITL/grupo/timeout/auditoria central. | RF-030; BR-010, BR-011, BR-028 |
| HU-021 | Como usuario, quiero invocar la orbe por voz y continuar mediante dictado/TTS. | Wake word abre orbe; mic/model status; parciales/final; TTS; stop/hide; errores visibles. | RF-031, RF-036 |
| HU-022 | Como usuario preocupado por privacidad, quiero parsear documentos y redactar texto en un proceso aislado. | Sidecar de tools separado; status; parse/redact; config privacidad; timeout/restart. | RF-032; RNF-005 |
| HU-023 | Como usuario, quiero conocer y aplicar actualizaciones sin descargar ejecutables manualmente. | Check; notas sanitizadas; progreso; descarga; instalacion explicita; errores. | RF-033; BR-021, BR-022 |
| HU-024 | Como owner, quiero automatizar tareas recurrentes conservando aprobacion y trazabilidad. | Templates/runs/cases; approve/reject; reglas pasivas; alertas proactivas; estados y auditoria. | RF-034, RF-035; BR-009 |
| HU-025 | Como usuario, quiero conversar con SofLIA mientras navego y retomar las acciones web que ejecuta el agente. | Panel derecho ajustable hasta ancho completo; chat activo a la izquierda; sesion e historial persistentes; contrasenas cifradas por origen; extensiones MV3 aprobadas; misma pagina para usuario y agente. | RF-039; BR-009, BR-018, BR-019 |

## Cobertura de excepciones

Para todas las historias: usuario no autenticado, integracion no configurada,
permiso denegado, timeout, desconexion, respuesta parcial, cancelacion y payload
invalido deben terminar en estado seguro y visible, no en ejecucion silenciosa.
