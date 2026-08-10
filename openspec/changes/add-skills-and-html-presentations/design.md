## Context

Ver `proposal.md` — Why. Restricciones del estado actual que condicionan el diseño:

- **Dos modelos de capacidad incompatibles.** `electron/presentation-workflow/` y `electron/whatsapp-workflow-meetings.ts` son máquinas de estado acopladas a `WhatsAppService` (envían texto con `waService.sendText`); `user_tools` (Supabase LIA) son presets de prompt que solo consume el renderer vía `src/services/tools-service.ts` y `useChatTools.ts`. Ninguno de los dos tiene un contrato reutilizable.
- **El catálogo de herramientas del modelo es estático.** `src/services/gemini-tools/index.ts` y `electron/wa-tools/index.ts` concatenan arrays fijos, y `tool-dispatch.ts` resuelve por pertenencia a `Set`s precalculados. No existe hoy un mecanismo para añadir herramientas por turno.
- **Ya existen herramientas de archivo sin acotar.** `write_file`, `create_directory` y `read_file` (`computer-file-tools.ts`) operan sobre cualquier ruta del disco a través de `executeComputerTool`. Sirven para el escenario general, pero no para dar al modelo un espacio de trabajo delimitado.
- **El branding ya está en la plataforma.** `organizations` (Supabase SOFIA) tiene `brand_color_primary/secondary/accent`, `brand_font_family`, `brand_logo_url`, `brand_favicon_url`, `brand_banner_url` y `branding_enabled`. Son URLs públicas: no hace falta la API de Storage. Main ya sabe crear un cliente SOFIA (`electron/iris/clients.ts` sobre `createMainSupabaseClient`).
- **El workspace del navegador ya resuelve la convivencia de superficies.** `BrowserWorkspaceLayout` compone un `WebContentsView` nativo a pantalla completa con un panel renderer flotante encima, calculando `viewportInsets`. El ícono de mundo del chat es `ToolsDropdownButton`.
- **Colisión de nombres.** `electron/memory/skills-*.ts` ya usa "skill" para memoria aprendida del usuario (preferencias, correcciones). Es un concepto distinto del de este cambio.

## Goals / Non-Goals

**Goals:**

- Un contrato de Skill único que el chat del Hub y WhatsApp resuelvan igual, con las guardas propias de cada superficie aplicadas encima.
- Un mecanismo de herramientas por turno que permita a una Skill del sistema aportar herramientas sin ampliar el catálogo base de ninguna superficie.
- Un espacio de trabajo de archivos delimitado y verificable, donde el escape de ruta sea imposible por construcción y no por convención.
- Una superficie de render de HTML generado por el modelo que no pueda alcanzar IPC, `node` ni la red.
- Retirar Gamma sin dejar el flujo de WhatsApp sin presentaciones.

**Non-Goals:**

- No se unifica el modelo de memoria aprendida (`electron/memory/skills-*.ts`) con el registro de Skills; solo se desambigua por nombre en documentación y UI.
- No se convierten las herramientas de archivo generales (`computer-file-tools.ts`) en herramientas acotadas: siguen existiendo para el escenario de escritorio.
- No se diseña un motor de plantillas configurable por el usuario; el aspecto se decide por prompt más branding.
- No se rediseña el workflow de reuniones de WhatsApp, aunque quede clasificado como Skill del sistema.

## Decisions

### D1. Registro de Skills: declaración en código, instancias en base de datos

Una Skill del sistema se declara en código como un objeto inmutable versionado (`id`, nombre, descripción, superficies habilitadas, herramientas que aporta, política de workspace, prompt). Una Skill del usuario es una fila de la tabla `skills` sin capacidad de declarar herramientas ni workspace.

El catálogo efectivo se resuelve uniendo ambas fuentes y filtrando por superficie e identidad. La clase se deriva de la fuente, no de una columna que el usuario pueda escribir: **una fila de la base de datos nunca puede convertirse en Skill del sistema**.

*Alternativa descartada:* declarar también las Skills del sistema en la tabla con un `is_system`. Habría permitido editarlas sin release, pero pone la frontera de privilegio en un booleano escribible por RLS mal configurada, y obliga a versionar prompts privilegiados fuera del repositorio.

### D2. Migración `user_tools` → `skills` con vista de compatibilidad

Migración SQL idempotente en `database/lia/migrations/`: crea `skills`, copia las filas de `user_tools` mapeando `system_prompt` → `instructions`, aplica RLS por `user_id` y crea una vista `user_tools` de solo lectura sobre `skills` durante una release.

La vista es lo que hace reversible el cambio: un renderer antiguo que consulte `user_tools` sigue leyendo, y el rollback del renderer no exige rollback de datos. La eliminación de la vista es un paso posterior explícito, no parte de este cambio.

*Alternativa descartada:* renombrar `user_tools` in place. Más barato, pero deja el nombre viejo en el esquema indefinidamente y no permite cambiar la forma de las columnas.

### D3. Herramientas por turno en vez de catálogo estático

Se introduce una capa que compone el catálogo del turno: `catálogo base de la superficie + herramientas aportadas por la Skill activa`, y un despachador que resuelve primero contra las herramientas de la Skill activa. `isKnownGeminiTool` y `tool-dispatch.ts` pasan a consultar ese catálogo compuesto en lugar de `Set`s de módulo.

Regla de seguridad: las herramientas aportadas por una Skill se validan contra la allowlist de la superficie antes de exponerse. Una Skill **no puede** ampliar lo que la superficie prohíbe; solo puede activar lo que la superficie permite pero no ofrece por defecto.

*Alternativa descartada:* añadir las herramientas del workspace al catálogo base y dejar que el prompt las desaconseje cuando no hay Skill activa. Rechazada: un catálogo que ofrece herramientas de escritura sin destino válido es una superficie de fallo permanente.

### D4. Workspace en `userData`, nunca en rutas del usuario

Cada presentación vive en `userData/presentaciones/<id>/`. La raíz la resuelve main con `app.getPath('userData')`; el renderer y el modelo **nunca** manipulan rutas absolutas: las herramientas reciben rutas relativas al workspace y main las resuelve.

Validación de contención en main, en este orden: rechazar rutas absolutas y rutas con segmentos `..`; resolver la ruta candidata; `realpath` del workspace y de la carpeta contenedora; comprobar que la ruta resuelta empieza por la raíz real del workspace más el separador. El `realpath` es lo que cierra el escape por enlace simbólico, que la simple comparación de prefijos no detecta.

*Alternativa descartada:* guardar en Escritorio o Documentos. Más visible para el usuario, pero pone contenido escrito por un modelo en un árbol con datos personales y complica el aislamiento. Se compensa con una acción explícita "abrir carpeta" y la exportación a un archivo único.

### D5. Render en dos superficies: `iframe` con esquema propio y vista nativa

**Vista previa embebida:** un esquema privilegiado propio (registrado con `protocol.registerSchemesAsPrivileged` antes de `app.ready` y servido con `protocol.handle`) entrega archivos **solo** desde la raíz de presentaciones, aplicando la misma validación de contención de D4 y devolviendo 404 para cualquier otra ruta. El renderer lo muestra en un `<iframe sandbox="allow-scripts">` sin `allow-same-origin`, lo que deja el documento en un origen opaco: sin acceso al `localStorage` del renderer, sin `window.parent` útil y sin las APIs expuestas por preload, que solo viven en el mundo principal del renderer.

**Vista a pantalla completa:** un `WebContentsView` con `nodeIntegration: false`, `contextIsolation: true`, sin preload y con una sesión particionada propia, siguiendo el patrón de `IntegratedBrowserService`. Se usa solo al presentar, porque es la única forma de ocupar la ventana sin que el chat compita por el z-order.

Ambas superficies aplican una CSP restrictiva por cabecera desde el handler del protocolo (`default-src 'self'`, sin `connect-src` externo), de modo que el HTML generado no pueda pedir recursos remotos aunque el modelo escriba una etiqueta que lo intente. Esto es también lo que hace verificable el requisito de "renderiza sin conexión".

*Alternativa descartada:* `iframe` con `srcDoc`. Evita el protocolo, pero obliga a inlinear todo, rompe las rutas relativas a CSS e imágenes y hace que el usuario no vea archivos reales, que es justo lo que este cambio quiere mostrar.

### D6. Branding resuelto en main

Main resuelve `organizations` contra SOFIA con el patrón de `electron/iris/clients.ts`, valida que cada URL de recurso pertenezca al host de Supabase SOFIA configurado, descarga con límite de tamaño y timeout, y escribe los recursos en `<workspace>/assets/`. El renderer no participa: pedir al renderer que descargue y luego mande bytes por IPC añade un salto sin ganancia.

Se cachea la identidad por organización en memoria con TTL corto, invalidada por cambio de organización activa y por cierre de sesión.

*Alternativa descartada:* resolver en el renderer con `sofiaSupa`, que ya existe allí. Rechazada porque el destino de los bytes es el disco, gestionado por main.

### D7. Prompt de la Skill como contrato de salida, no como estilo

El prompt de la Skill de presentaciones fija: estructura de archivos esperada, uso obligatorio de las variables CSS de marca inyectadas por el sistema, prohibición de recursos remotos, y la obligación de usar edición por reemplazo en las iteraciones en lugar de reescribir archivos completos.

El branding **no se pasa como texto** para que el modelo lo interprete: main escribe un archivo de variables CSS en el workspace antes de que el modelo empiece, y el prompt obliga a consumirlas. Así la identidad corporativa no depende de que el modelo copie bien un hexadecimal.

### D8. WhatsApp: mismo motor, entrega por archivo

`PresentacionWorkflow` conserva su máquina de estados y sus mensajes, pero el paso de generación deja de llamar a Gamma: crea un workspace, ejecuta la Skill, empaqueta la presentación en un HTML autocontenido y entrega el archivo por el canal existente de envío de archivos. `gamma.ts` se elimina y `GAMMA_API_KEY` deja de leerse.

**No se exporta a PDF.** La razón de generar en HTML es que el navegador permite transiciones, animaciones de entrada y profundidad; imprimir a PDF aplana exactamente eso y devuelve una baraja de imágenes. En su lugar, `export-html.ts` produce **un solo archivo**: incrusta las hojas de estilo enlazadas dentro de `<style>` conservando su orden —`marca.css` antes que los estilos propios, o la identidad se rompe— y convierte las imágenes locales a `data:`. El archivo se abre en cualquier navegador sin conexión y viaja por correo o WhatsApp como adjunto único.

*Alternativa descartada:* enviar un ZIP con la carpeta. Conserva el movimiento igual, pero obliga a descomprimir antes de ver nada; en un teléfono eso es una barrera real.

### D9. Desambiguación de "skills" en el código

El registro nuevo usa el prefijo `skill-registry`/`skills` en canales IPC y módulos de producto; la memoria aprendida conserva `electron/memory/skills-*.ts` sin cambios funcionales y se documenta explícitamente como *memoria aprendida* en `docs/architecture/runtime-agents-manual.md`. No se renombran archivos de memoria en este cambio: el renombre tocaría rutas estables sin beneficio de comportamiento.

## Risks / Trade-offs

- **El modelo genera HTML que no renderiza o queda a medias** → El panel muestra los archivos reales y el control de reproducción solo se habilita cuando existe el documento de entrada; los errores de escritura se reportan por archivo en vez de fallar el turno completo.
- **Inyección de instrucciones desde la fuente** (DOM de una web, documento subido) → El contenido de fuentes se marca como dato no confiable en el prompt, igual que ya hace `read_browser_dom`; la Skill no puede ejecutar herramientas fuera de las de su workspace, de modo que el peor caso es una presentación con contenido malicioso, no una acción sobre el sistema.
- **Escape de ruta por enlace simbólico o unidad de red** → Validación con `realpath` en main (D4) y pruebas dirigidas con rutas `..`, absolutas y symlinks; el protocolo aplica la misma validación, no una propia.
- **La CSP restrictiva rompe presentaciones que el modelo quería con fuentes web** → Es deliberado: el requisito es que renderice sin conexión. La tipografía de marca se resuelve con las fuentes del sistema declaradas en las variables CSS.
- **El catálogo por turno introduce una ruta nueva en un despachador crítico** → El catálogo compuesto degrada al catálogo base cuando no hay Skill activa, y se cubre con pruebas de que sin Skill el conjunto de herramientas es idéntico al actual.
- **Crecimiento indefinido de `userData/presentaciones/`** → Límite por workspace y por raíz, con purga de proyectos sin conversación asociada; el usuario puede abrir y borrar la carpeta.
- **Una `WebContentsView` más compite por el presupuesto de vistas Chromium** que ya gestiona el navegador integrado → La vista de pantalla completa se crea bajo demanda y se destruye al cerrar, y no coexiste con el modo navegador.
- **La migración toca datos vivos de usuarios** → Migración idempotente, verificada con conteo previo y posterior, y vista de compatibilidad que permite revertir solo el renderer.

## Migration Plan

1. Aplicar la migración SQL en Supabase LIA: crear `skills`, RLS, copiar `user_tools`, crear la vista de compatibilidad. Verificar que el conteo de filas coincide por usuario.
2. Desplegar el código con la Skill de presentaciones detrás de una bandera de habilitación; el resto del catálogo de Skills queda activo.
3. Habilitar la Skill de presentaciones en el chat, validar el ciclo completo (generar, ver código, reproducir, iterar, exportar).
4. Cambiar el flujo `/presentacion` de WhatsApp al motor propio y retirar `gamma.ts` y `GAMMA_API_KEY`.
5. En una release posterior, eliminar la vista de compatibilidad `user_tools`.

**Rollback:** apagar la bandera deja el catálogo de Skills operativo sin la Skill de presentaciones. Revertir el renderer completo sigue funcionando mientras exista la vista `user_tools`. El paso 4 se revierte restaurando `gamma.ts` desde el historial y su variable de entorno; los pasos 1 a 3 no requieren rollback de datos.

## Open Questions

- Cuántas diapositivas por defecto y qué densidad de texto se consideran "ejecutivas" para el prompt inicial: se ajusta con uso real sin cambiar specs ni contratos.
- Si la vista a pantalla completa debe ofrecer notas del presentador: no altera el contrato de render ni el desglose de tareas.
