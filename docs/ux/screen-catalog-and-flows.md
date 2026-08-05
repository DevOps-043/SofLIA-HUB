# Catalogo de pantallas y flujos

Estado: vigente. Actualizado: 2026-08-04.

<!-- evidence: src/app/AppWorkspace.tsx -->
<!-- evidence: src/app/AppModals.tsx -->
<!-- evidence: src/components/UnifiedSettingsModal.tsx -->

## Pantallas y superficies

| Superficie | Entrada/condicion | Datos/servicios | Acciones principales | Estados requeridos |
|---|---|---|---|---|
| Startup | ventana principal | theme + auth lifecycle | ninguna durante intro | animando, gracia auth, salida |
| Auth | sin user y no orb | SOFIA auth | login/recuperacion segun componente | loading, error, credenciales invalidas |
| Workspace Chat | `activeView=chat` | chat, messages, IA, tools | nuevo/enviar/adjuntar/share/delete | vacio, streaming, tool, error, degraded |
| Navegador integrado | boton Navegador o apertura del agente | `IntegratedBrowserService`, historial, boveda, extensiones, Computer Use | mover/minimizar/ajustar chat, navegar, abrir gestores flotantes, guardar/rellenar, instalar/deshabilitar/remover | carga, vacio, cancelacion, error, permiso HITL, agente controlando |
| Sidebar | workspace autenticado | chats, folders, IRIS, org/user | seleccionar, crear, pin, rename, delete, tema, settings | loading por seccion, menu contextual |
| Project Hub | `project` + folder + user | sources/chats/folder/Drive | fuente, chat de proyecto, share | empty source/chat, picker, error |
| Productividad | `productivity` + user | monitoring, summaries, calendar | rango, start/stop, auto config | sin datos, sesion activa, resumen, error |
| Meetings | `meetings` + user | meeting runs/detail/live | crear, detectar, revisar, aprobar, sync | lista vacia, processing, pending, failed |
| SDO | `sdo` + user | decisions/claims/actions/audit | crear, detalle, aprobar/rechazar, artifact | filtros, vacio, vigencia, error |
| Settings | modal global | settings + APIs de cada dominio | navegar/editar/autosave/test | loading por tab, dirty/saving/error |
| Share modal | target conversacion/folder | members, grants, links | grant, copy, revoke | tabs, loading, link, error |
| Folder modal | crear/editar/mover | folder service | guardar/cancelar | validacion/error |
| Tool library/editor | settings/workflow | tools/user tools | activar, favorito, editar prompt | loading, empty, invalid |
| WhatsApp setup | tab WhatsApp | wa status/QR/config/history | connect, allowlists, groups, persona | unavailable, disconnected, pairing, connected, error |
| Updater panel/notification | global + settings | updater events | check, download, install, expand notes | idle, checking, available, progress, ready, error |
| Orbe | `view=orb`/shortcut/wake | voice, TTS, meeting live, conversation | wake, dictate, speak, stop, hide | idle, listening, thinking, speaking, error |
| Screen viewer | tools/desktop | screen sources/capture | elegir fuente, refresh | loading, no source, screenshot, error |
| User management | tab Members con org | org members/invites | role, invite, list | loading, empty, error |

## Flujos criticos

### Login y scope

```text
Startup -> resolver sesion SOFIA
  -> sin sesion: Auth
  -> con sesion: cargar perfil/memberships
     -> resolver Lia
     -> seleccionar org guardada/permitida
     -> cargar chat/folders/IRIS
     -> Workspace (o notice degradado Lia)
```

### Chat con herramienta

```text
Enviar mensaje -> persistir/pending -> stream IA
  -> texto: render incremental
  -> function call: validar/declarar tool
     -> si critica: confirmacion humana
     -> IPC main -> servicio -> resultado serializable
     -> devolver resultado al modelo
  -> persistir respuesta/fallo recuperable
```

### Navegador compartido con el agente

```text
Usuario abre Navegador o solicita una tarea web en Chat
  -> Sidebar se oculta; navegador ocupa el espacio libre y el chat activo usa un panel compacto
  -> usuario ajusta el grip, mueve el panel entre lados o lo minimiza; la conversación sigue montada
  -> barra superior agrupa navegación, dirección, expansión y cierre; la fila secundaria contiene título, favoritos, extensiones instaladas e historial/contraseñas/extensiones, y puede ocultarse y restaurarse
  -> dirección sugiere URLs recientes deduplicadas, ignora coincidencias exclusivas del protocolo y admite flechas, Enter, Escape o puntero en un menú flotante que se superpone sin desplazar pestañas, favoritos ni página
  -> al abrir predicciones: captura una vez la página, oculta temporalmente la capa nativa y restaura la misma vista al seleccionar, pulsar Escape, perder foco o quedar sin resultados
  -> la fila de pestañas permite crear, activar, cerrar y elegir una segunda vista dividida o superpuesta; al superar ocho vistas vivas suspende por LRU hasta un máximo de 500 pestañas lógicas
  -> Separar pestaña mueve la misma vista a una ventana nativa; Integrar o cerrar esa ventana la devuelve sin recarga, con máximo cuatro ventanas dentro de las ocho vistas vivas
  -> popups HTTP(S) se convierten en pestañas internas; la pestaña enfocada queda marcada como objetivo del agente
  -> el panel de SofLIA mide el inicio de la página y queda alineado debajo de esa barra, sin cubrirla
  -> renderer publica bounds con inset en el lado del chat; al minimizar recupera todo el ancho
  -> main crea o reutiliza WebContentsView + sesion persistente aislada
  -> el chat permite cambiar modelo y razonamiento mediante filas tipo menú; otro popover buscable permite abrir un chat existente o crear uno nuevo sin restaurar la Sidebar
  -> el compositor es delgado, usa padding simétrico, omite herramientas y Compartir, y no genera scroll horizontal
  -> Modo Orbe abre la Orbe general movible, oculta el chat sin desmontarlo y deja un control para restaurarlo
  -> la vista nativa permanece visible e interactiva durante el chat; main mantiene una captura visual pasiva y obtiene DOM saneado bajo demanda sin usar PNG para componer la página
  -> el control de ojo pausa o reactiva la percepción; al pausar se descarta la evidencia retenida
  -> al abrir un gestor: captura puntual, oculta la capa nativa y superpone el modal redondeado
  -> al cerrar el gestor: restaura bounds sobre la misma pagina, cookies y sesion
  -> borrados e instalacion muestran confirmacion renderer con foco contenido antes del IPC mutador
  -> navegacion manual o use_computer captura la misma pagina visible
  -> cada turno con el navegador visible puede adjuntar la observación reciente; el DOM se marca como página no confiable
  -> acciones del agente reciben captura y DOM de esa vista; si falla, no saltan al navegador externo
  -> Computer Use usa Gemini 3.6 Flash y un presupuesto web de 90 pasos, con tope 120 y salida anticipada al completar
  -> usuario observa, interrumpe o retoma sobre la misma sesion
  -> historial se registra; favoritos HTTP(S) se sanean y guardan localmente con límite; bóveda/extensiones solo responden a gesto humano; extensiones muestran permisos opcionales y permiten reintentar una carga fallida
  -> al cerrar, la vista se oculta y Sidebar/vista anterior se restauran
```

### Reunion gobernada

```text
Manual/Drive/live/deteccion -> meeting_run + source hash
  -> extraccion/normalizacion -> meeting_asset versionado
  -> revision humana
     -> rechazo/edicion: vuelve a pendiente
     -> aprobacion: registra meeting_approval
  -> sync actions idempotentes -> IRIS/Workspace
  -> adapter SDO registra resultado aprobado
```

### Tool dinamica

```text
archivo toolset -> loader valida contrato cerrado
  -> registry + fingerprint
  -> WhatsApp preflight y dialogo HITL si aplica
  -> executor revalida fingerprint/agent/group/HITL
  -> input Zod -> handler con AbortSignal -> output Zod
  -> auditoria minimizada -> respuesta
```

### Update

```text
timer/manual check -> release disponible
  -> usuario descarga -> progreso -> update-downloaded
  -> usuario instala -> electron-updater reinicia
```

## Casos negativos comunes

- Sin `userId`: no renderizar productividad/meetings/SDO.
- Sin organizacion: ocultar Miembros y no ofrecer share organizacional.
- Sin API key/provider: mostrar no configurado; no fingir resultado IA.
- Denegacion/HITL: conservar tarea pendiente y explicar siguiente accion.
- Timeout: liberar loading y ofrecer reintento solo si es seguro/idempotente.
- Ventana cerrada: main no debe enviar a `webContents` destruido.
