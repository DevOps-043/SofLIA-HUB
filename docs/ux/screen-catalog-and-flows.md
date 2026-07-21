# Catalogo de pantallas y flujos

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/app/AppWorkspace.tsx -->
<!-- evidence: src/app/AppModals.tsx -->
<!-- evidence: src/components/UnifiedSettingsModal.tsx -->

## Pantallas y superficies

| Superficie | Entrada/condicion | Datos/servicios | Acciones principales | Estados requeridos |
|---|---|---|---|---|
| Startup | ventana principal | theme + auth lifecycle | ninguna durante intro | animando, gracia auth, salida |
| Auth | sin user y no orb | SOFIA auth | login/recuperacion segun componente | loading, error, credenciales invalidas |
| Workspace Chat | `activeView=chat` | chat, messages, IA, tools | nuevo/enviar/adjuntar/share/delete | vacio, streaming, tool, error, degraded |
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
