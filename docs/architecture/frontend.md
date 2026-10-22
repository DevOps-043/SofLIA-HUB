# Arquitectura frontend

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/main.tsx -->
<!-- evidence: src/app/AppContent.tsx -->
<!-- evidence: src/app/AppWorkspace.tsx -->

## Entrada y composicion

`src/main.tsx` monta `App`; `src/App.tsx` envuelve la aplicacion en
`AuthProvider`, renderiza `AppContent` y mantiene `UpdateNotification` global.
No se usa React Router: `ActiveView` es la union `chat | project |
productivity | meetings | live-sessions`. `AppWorkspace` selecciona chat y herramientas
con render condicional; `AppContent` presenta la agenda y el aula de Learning.

`AppContent` coordina:

- autenticacion SOFIA/Lia y organizacion activa;
- managers de chat y carpetas;
- tema y posicion de sidebar (`left`, `right`, `bottom`);
- enlaces compartidos y triggers de reunion recibidos por IPC;
- agenda de sesiones síncronas de la organización, estudio de diseño del instructor y lienzo del participante, independientes del navegador y del chat general;
- ventana normal frente a ventana `orb`;
- modales de share, folders y settings.

El intro de inicio dura 4200 ms, concede 700 ms adicionales al auth y anima la
salida 1250 ms. Son parametros UI en `src/app/AppContent.tsx`, no tiempos de SLA.

La pantalla de acceso monta `AppTitleBar` desde
`src/components/auth/AuthChrome.tsx`. La barra permanece encima del formulario
desplazable y reutiliza `WindowControls` para minimizar, maximizar/restaurar y
cerrar sin sesión, mediante `src/services/window-controls-service.ts` y la API
preload existente. La región libre de la barra permite arrastrar la ventana.
La tarjeta se centra en el espacio restante cuando cabe; si no cabe, se desplaza
verticalmente sin ocultar la barra.

### Adjuntos de contexto del turno

El compositor del chat admite dos origenes de contexto que comparten el area de
chips y el presupuesto del turno: las pestañas del navegador integrado y las
aplicaciones abiertas del equipo. `src/adapters/desktop_ui/chat-ui/` aloja
ambos: `input/TabAttachmentPicker.tsx` e `input/AppAttachmentPicker.tsx` para
elegir, `input/*AttachmentChips.tsx` para mostrar lo adjunto y
`app-attachments.ts` para armar el bloque que recibe el modelo.

Los dos difieren en cuando leen. Una pestaña resuelve su texto en `handleSend`
porque el navegador es nuestro y el contenido esta a una llamada. Una aplicacion
arranca su lectura al marcarse, porque el chip debe declarar la fidelidad real
—documento completo, texto de la ventana o captura— antes de que el usuario
envie: enterarse despues no le sirve de nada. Al enviar solo se espera lo que
siga en curso, y lo que no llegue se declara como no leido en lugar de retener
el turno.

## Capas del renderer

| Ruta | Responsabilidad | Regla de dependencia |
|---|---|---|
| `src/app/` | composicion, vistas, notices, modales y triggers | puede usar hooks/components/services; no accede a Node |
| `src/components/` | pantallas y componentes de dominio | debe delegar I/O en services/hooks |
| `src/components/ui/` | primitives Button, Card, fields, Toggle, Badge, Select | no contiene reglas remotas |
| `src/hooks/` | estado coordinador y efectos | no crea clientes main ni secretos |
| `src/services/` | contratos renderer, Supabase y wrappers `window.*` | valida/normaliza respuestas y expone tipos |
| `src/contexts/` | sesion e identidad | SOFIA es principal; Lia se resuelve aparte |
| `src/lib/` | clientes Supabase y tipos compartidos | cada instancia usa storage key/config propia |
| `src/core/` | entidades/ports/use cases experimentales | no es aun la unica arquitectura del renderer |
| `src/adapters/` | adaptadores UI/infra de modulos migrados | implementa ports sin saltar preload |

## Flujo de datos

```text
interaccion UI
  -> componente / hook
  -> src/services/<dominio>
  -> window.<api> expuesta por preload  O  cliente Supabase renderer
  -> normalizacion/cache/estado React
  -> render de resultado, degradacion o error
```

Supabase renderer se usa para datos de UI; filesystem, procesos, canales, OAuth,
captura y automatizacion siempre cruzan preload. `createElectronSupabaseClient`
persiste sesiones en `localStorage`, deshabilita deteccion de sesion por URL y usa
fetch con timeout/retry controlados.

## Estado y cache

- Chat divide cache, remote, pending state, recovery y sync bajo
  `src/services/chat/`; no existe un store global de Redux.
- Folder sigue el mismo patron bajo `src/services/folder/`.
- Auth se descompone en hooks de ciclo de vida, SOFIA, Lia y sign-out.
- Settings usa carga/guardado y formularios por modal; la navegacion tiene once
  tabs declaradas en `src/components/unified-settings/settings-tabs.tsx`.
- Estado UI efimero (view, modal, sidebar) usa hooks locales; posicion/tema tambien
  se sincronizan con main cuando existe API.
- Las preferencias personales en `localStorage` se acotan al usuario activo con
  `scopedPreferenceKey` (`src/services/user-scope.ts`): favoritos y ajustes del
  navegador, modelo elegido y cache de ajustes personales. El ambito se fija en
  `useAuthProviderModel` durante el render, y al iniciar sesion se descarta lo
  guardado sin sesion. Una preferencia nueva que revele actividad del usuario
  debe usar esa clave, no una global.
- Borrar una conversacion es un borrado logico: se marca
  `conversations.deleted_at` en Supabase y ni la fila ni sus mensajes se
  destruyen. Esa marca es lo unico que viaja entre equipos; al cargar,
  `reconcileRemoteConversationDeletions`
  (`src/services/chat/operations/reconcile-deletions.ts`) la traduce a lapida
  local. Sin eso, el equipo que no ejecuto el borrado volvia a listar el chat y
  a subirlo desde su cache.
- Ademas queda una lapida durable por usuario
  (`lia_deleted_conversations_<id>`, `src/services/chat/tombstones.ts`) que
  sobrevive al sync. Los listados, la recuperacion de cache, el guardado de
  mensajes y la migracion de identidad la respetan: un borrado no se revierte
  porque el borrado remoto haya fallado en silencio.
- El cliente tolera que la migracion
  `database/lia/migrations/conversations-soft-delete.sql` no este aplicada:
  reintenta las lecturas sin el filtro y avisa una vez en consola, pero hasta
  ejecutarla los borrados solo valen en el equipo que los hizo.

## Estados visuales obligatorios

Cada pantalla remota debe distinguir carga, vacio, error, degradado y contenido.
Ejemplos existentes: `tool-library/ToolLibraryStates.tsx`, notices de Lia,
WhatsApp disconnected/pairing/unavailable y tarjetas de updater. Los nuevos
componentes deben reutilizar primitives y no depender de un `alert()` generico.

## Código y portapapeles del chat

Los bloques de `src/components/chat/markdown-renderer/CodeBlock.tsx` usan una
instancia acotada de highlight.js en `markdown-renderer/code-highlight.ts`, con
gramáticas explícitas para BAT/CMD, PowerShell, Bash, JavaScript/TypeScript,
Python, JSON, SQL, HTML/XML, CSS, Java, YAML y diff. La paleta compartida de
`src/index.css` mantiene colores claros sobre el fondo oscuro del bloque incluso
en el tema claro. El contenido se escapa; la prosa, los lenguajes desconocidos y
los bloques de más de 120000 caracteres se muestran como texto literal.

`src/services/clipboard-service.ts` reutiliza
`window.computerUse.clipboardWrite` y comprueba `success === true`. No cambia
permisos ni canales y respeta los rechazos del puente nativo. Sin puente, intenta
la API web en contexto seguro y después la selección temporal, restaurando el
foco y retirando el elemento auxiliar incluso si falla.
`src/hooks/useCopyToClipboard.ts` comparte estados de espera, éxito de dos
segundos y error con reintento entre bloques de código y citas. La copia general
del mensaje conserva su import compatible en `hooks/chat-processor/clipboard.ts`.
Siempre se copia el texto original, con sangría y líneas vacías, nunca el HTML
del resaltado. La clave del bloque se basa en su línea inicial para mantener su
estado durante respuestas en streaming.

## Seguridad del renderer

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Solo APIs expuestas por `contextBridge`.
- `SafeReleaseNotes` limita a 8000 caracteres y sanitiza el contenido antes de
  renderizar notas externas.
- URLs, archivos y comandos pasan a main; el renderer no los ejecuta.

## Deuda/limites documentados

- No toda la UI esta migrada a `src/features/<dominio>`; `components` y `services`
  siguen siendo la estructura dominante.
- `any` permanece en contratos legacy; TypeScript estricto no equivale a cero
  casts ni a validacion runtime.
- El bundle renderer mantiene advertencias de tamano registradas en reportes de
  verificacion; dividirlo requiere una iniciativa de performance separada.
- No existe libreria formal de rutas ni sistema i18n; el idioma operativo es
  espanol por politica del repositorio.


## Visor de entregables junto al chat

<!-- evidence: src/components/artifacts/ArtifactViewerProvider.tsx -->
<!-- evidence: src/components/artifacts/ArtifactViewerPanel.tsx -->
<!-- evidence: src/components/agents/TeamFiles.tsx -->

Las tarjetas de archivos del equipo abren `ArtifactViewerPanel` junto al chat,
con pestañas de entregables, vista previa/código cuando aplica, ampliación,
Guardar copia y apertura externa explícita. «Abrir archivo» en Herramientas usa
el selector del sistema. No necesita Word o Excel instalados para la lectura.
El visor comparte MarkdownRenderer y lectores existentes; tablas se representan
con texto escapado y los documentos/HTML en iframes aislados. Las presentaciones
del workspace conservan su visor existente. Para PPTX y Word se declara la vista
de contenido/lectura y se conserva el original para su aplicación de autoría.

El proveedor se remonta al cambiar chat, usuario u organización. Cada carga
activa descarta respuestas tardías; imágenes liberan sus blobs y PDF destruye su worker al cerrar.
En pantallas estrechas el visor flota sobre el chat y se puede cerrar; en escritorio
reserva espacio junto a la conversación. La carga, los errores recuperables y
los límites de vista son visibles.

En el navegador integrado, el visor ocupa el área del chat flotante y conserva
los límites nativos. Word y HTML muestran un indicador hasta cargar su iframe;
Word usa el origen local de lectura con scripts denegados.


## Espacio de archivos adaptable

<!-- evidence: src/components/artifacts/useResizablePanel.ts -->
<!-- evidence: src/components/artifacts/ArtifactFileIcon.tsx -->

El monitor lateral agrupa archivos por encargo, sin tarjetas ni operaciones de
agentes. SofLIA presenta una síntesis en el chat. Los iconos distinguen Word,
Markdown, PDF, Excel, PowerPoint, imágenes y código. Las acciones del visor se
sitúan en la cabecera con etiquetas accesibles; las pestañas mantienen visible
la selección. No hay pies permanentes de lectura o vista local. El ajuste de
ancho se comparte entre monitor y visor, admite arrastre y teclado, conserva una
preferencia visual y se cancela al cerrar durante un arrastre. La vista del
archivo no se vuelve a solicitar al redimensionar.


<!-- evidence: src/components/PanelResizeGrip.tsx -->

El sidebar, el monitor de archivos y el visor reutilizan `PanelResizeGrip`.
Conserva la barra de 4 px y las alturas 32/64/96 px para reposo, hover y arrastre,
con el brillo original del sidebar. La cabecera del visor tiene iconos de 19 px
por formato y acciones de 14 px; las pestañas usan iconos de 15 px y una altura
compacta de 26 px. Se evita mantener tres estilos de indicador divergentes.
