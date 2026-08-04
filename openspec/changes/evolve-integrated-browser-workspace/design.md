## Context

El cambio `add-integrated-agent-browser` incorporó un único `WebContentsView` persistente y seguro, pero lo presenta como `activeView='browser'`, reemplazando todo el chat. La nueva solicitud convierte esa superficie en un modo colaborativo: chat con SofLIA a la izquierda y navegador a la derecha, con persistencia adicional de historial, credenciales y extensiones.

Electron 39 ofrece sesiones persistentes, `safeStorage` y carga de extensiones desempaquetadas por sesión. No incorpora el gestor de contraseñas de Chrome ni soporta Chrome Web Store o compatibilidad total con sus extensiones. El contenido remoto y las extensiones son fronteras no confiables; ninguna operación de credenciales o instalación se expone al agente runtime.

## Goals / Non-Goals

**Goals:**

- Mantener una sola instancia de chat y una sola vista web en un split ajustable, restaurable y compatible con apertura del agente.
- Registrar navegación útil con límites, saneamiento y recuperación ante archivos parciales.
- Guardar credenciales por origen con cifrado del SO y rellenarlas únicamente por gesto explícito, sin enviar secretos al renderer o modelo.
- Administrar extensiones desempaquetadas compatibles mediante validación, confirmación, copia controlada, carga por sesión y remoción recuperable.
- Mantener el contrato Electron de cuatro capas y pruebas negativas por permisos, rutas, payload y ciclo de vida.

**Non-Goals:**

- Chrome Web Store, `.crx`, sincronización de perfil, compatibilidad total con Chrome o extensiones silenciosas.
- Capturar automáticamente envíos de formularios, mostrar contraseñas guardadas o permitir autofill al agente.
- Múltiples pestañas, perfiles por organización o sincronización cloud de datos del navegador.

## Decisions

### El modo navegador es estado ortogonal, no una `ActiveView`

`AppContent` mantendrá `isBrowserWorkspaceOpen` y el ancho del panel por separado de la vista activa. Al abrirlo se renderiza una única `AppChatView` en la región izquierda y `IntegratedBrowserPanel` a la derecha; la Sidebar de navegación no se monta. El splitter usa pointer capture, un mínimo de 420 px y un máximo igual al ancho disponible. Al alcanzar el máximo, el chat queda oculto y el navegador ocupa el workspace completo. El ancho se guarda en `localStorage`; cerrar restaura la Sidebar y la vista anterior.

Esto evita dos controladores de chat simultáneos y conserva exactamente la conversación activa. Mantener `activeView='browser'` habría obligado a duplicar o desmontar el chat sin una región colaborativa.

### Historial JSONL acotado en main

`BrowserHistoryStore` registra solo navegaciones principales HTTP(S) completadas, con UUID, URL sin credenciales, título y timestamp. Ignora `about:blank`, errores, navegación interna y protocolos no permitidos; conserva un máximo de 2.000 entradas y compacta mediante escritura temporal + rename. La consulta acepta texto y límite validado. Borrar historial requiere gesto explícito y no borra cookies.

JSONL evita una migración SQLite para una lista append-heavy pequeña y permite ignorar líneas corruptas. No se reutiliza el historial Chromium porque Electron no ofrece una UI/contrato estable para consultarlo.

### Bóveda por origen con `safeStorage` y autofill por eventos de entrada

`BrowserCredentialVault` guarda metadata en JSON y cada secreto cifrado con la API síncrona de `safeStorage` disponible en Electron 39. Las operaciones se limitan a strings pequeños en main; se migrarán a la API asíncrona cuando la versión tipada del proyecto la incorpore. Falla cerrado si no hay cifrado seguro; en Linux rechaza el backend `basic_text`. El renderer solo recibe id, origen, username y fechas. Guardar/actualizar/eliminar exige una acción de usuario.

El llenado valida que el origen actual HTTPS (o localhost HTTP) coincida exactamente. Main localiza rectángulos de campos mediante un script sin secretos y escribe username/password con foco + `sendInputEvent`/`insertText`; la contraseña no aparece en código inyectado, respuestas IPC, logs ni capturas del modelo. Se descarta captura automática de formularios porque ampliaría de forma innecesaria la exposición del secreto.

### Extensiones administradas y desempaquetadas

El usuario selecciona una carpeta mediante diálogo nativo. `BrowserExtensionManager` valida `manifest.json`, nombre/versión, Manifest V3, número/tamaño de archivos, ausencia de symlinks y permisos declarados. Se rechazan permisos de alto riesgo no soportados por política (`nativeMessaging`, `debugger`, `proxy`, `management`) y se muestra un diálogo nativo con permisos y hosts antes de copiar a `userData/integrated-browser/extensions/<installId>`.

La sesión persistente carga extensiones habilitadas con `session.extensions.loadExtension` cada vez que se inicializa la vista, porque Electron no las recuerda entre ejecuciones. El registro no expone paths al renderer. Deshabilitar descarga la extensión; remover exige confirmación, descarga y elimina solo la carpeta validada dentro del root administrado. No se aceptan `.crx` ni URLs de tienda.

### Contrato IPC segmentado

Se añade un grupo de canales dedicado para historial, bóveda y extensiones. Los handlers reutilizan autenticación/sender del navegador base, validan límites y devuelven respuestas serializables. Las operaciones de secretos y extensiones no se agregan a herramientas del agente. El wrapper renderer ofrece métodos por dominio y la UI usa drawers/modales con estados loading/error/vacío.

## Risks / Trade-offs

- [Una extensión puede observar páginas y credenciales rellenadas] → advertencia explícita, permisos visibles, denylist de permisos críticos, instalación manual y remoción accesible; no se promete aislamiento entre una extensión aprobada y las páginas que modifica.
- [La bóveda local puede ser descifrada por otro proceso del mismo usuario en Windows] → se documenta el modelo DPAPI; nunca se sincroniza ni expone por IPC en claro.
- [El split deja poco espacio al chat] → breakpoint de ancho, mínimo del navegador y modo completo reversible; una sola instancia de chat evita estado divergente.
- [Historial crece o se corrompe] → límite de 2.000, consultas acotadas, saneamiento y compactación atómica.
- [Una extensión desaparece o deja de ser compatible] → estado `error` visible y resto de extensiones continúa cargando.
- [Autofill elige un campo incorrecto] → solo acción explícita, origen exacto y heurística limitada a campos visibles/editables; error controlado sin revelar el secreto.

## Migration Plan

1. Archivar o integrar primero `add-integrated-agent-browser`; este cambio depende de su servicio y contratos.
2. Introducir stores/servicios y handlers con pruebas, sin activar todavía el nuevo layout.
3. Añadir UI de historial, credenciales y extensiones; migrar la apertura a `isBrowserWorkspaceOpen`.
4. Retirar `ActiveView='browser'` cuando consumidores y pruebas usen el estado ortogonal.
5. Verificar build, suite dirigida y smoke manual. Rollback: desactivar el workspace avanzado y volver a la vista exclusiva; los archivos locales quedan inertes. La remoción de datos requiere acción separada del usuario.

## Open Questions

Ninguna bloqueante. La sincronización entre dispositivos, múltiples perfiles y un catálogo firmado de extensiones requieren cambios posteriores con modelo de identidad y distribución propios.
