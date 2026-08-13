# Estrategia e inventario de pruebas

Estado: vigente. Actualizado: 2026-08-06.

El inventario del cambio contiene 361 archivos de prueba: 267 para main y 94
para renderer. El validador documental recalcula estas cifras; el numero de casos
ejecutados se registra en el reporte de evidencia de cada cambio, no aqui.

<!-- evidence: vitest.config.ts -->
<!-- evidence: electron/__tests__ -->
<!-- evidence: src/__tests__ -->
<!-- evidence: electron/sqlite/database.ts -->

## Proyectos Vitest

| Proyecto | Entorno | Include | Setup |
|---|---|---|---|
| `main` | Node | `electron/__tests__/**/*.test.ts` | `test/setup-main.ts`, alias Electron a mock |
| `renderer` | jsdom | `src/__tests__/**/*.test.ts(x)` | `test/setup-renderer.ts` |

Timeout de test y hook: 15 segundos. Los tests que prueban timeouts mayores deben
usar clocks/mocks o justificar override local, no aumentar el global sin evidencia.

## Tipos de evidencia existentes

- Unit: normalizadores, helpers, policies, schema y estados.
- Integration in-process: servicios con SQLite temporal, handlers y dispatchers.
- Renderer: componentes/hooks con Testing Library y jsdom.
- Source/contract: presencia de controles preload, canales, scripts y formatos.
- Build: TypeScript y bundles main/preload/renderer.
- Release: artifacts por OS y smoke de AppImage Linux.

No hay suite E2E empaquetada que automatice Windows/macOS completos ni proveedor
real de WhatsApp/Google/Supabase/Gemini. Dobles locales no sustituyen pruebas de
contrato en entorno autorizado.

### Skills y presentaciones

La verificación del motor base cubre el lienzo limitado a la ventana, el ajuste
en un marco de altura visual explícita sin espacio fantasma, el mayor factor que cabe, la coreografía
semántica con Web Animations, el estado final con movimiento reducido y el informe local para contenido fuera del lienzo,
imágenes rotas, titulares largos y diapositivas activas sin contenido visible.
El contrato actual separa autoría y render: el agente solo escribe `deck.json`;
el esquema limita densidad, rutas, arquetipos y vocabulario de movimiento. El
reproductor React conserva un lienzo lógico 1920×1080 y el servidor loopback
solo sirve recursos allowlisted mediante una sesión opaca. El contrato del
prompt fija además arquitectura narrativa, evidencia por diapositiva,
composición editorial en vez de dashboards de tarjetas y revisión en 16:9 y
movimiento reducido.

| Suite | Qué demuestra |
|---|---|
| `src/__tests__/shared/presentation-deck-schema.test.ts` | El contrato declarativo acepta los ocho arquetipos y rechaza ids repetidos, densidad excesiva, rutas fuera de `assets/`, tipos desconocidos y repetición editorial consecutiva. |
| `electron/__tests__/presentation-runtime-server.test.ts` | El servidor React usa loopback y token opaco, valida el deck antes de abrir, sirve únicamente bundle/contrato/marca/recursos y rechaza archivos arbitrarios del workspace. |
| `electron/__tests__/skill-workspace-paths.test.ts` | Contención de rutas contra el sistema de archivos real: `..`, ruta absoluta externa, enlace simbólico hacia fuera, carpeta enlazada hacia fuera y hermano con prefijo común. El caso del symlink no se reproduce con rutas simuladas, por eso la suite escribe en disco. |
| `electron/__tests__/skill-workspace-service.test.ts` | El diagnostico de una edicion fallida, que es lo que evita quince reintentos identicos: avisa si el fragmento existe con otro formato, devuelve el contenido real de alrededor, manda releer cuando no hay rastro y dice en que lineas esta el fragmento ambiguo. Ademas: límites por archivo, por workspace y de extensión; edición por reemplazo exacto con sus tres desenlaces (único, inexistente, ambiguo); archivos protegidos que el modelo no puede reescribir, editar ni borrar; actualización silenciosa e idempotente de un protegido solo por el sistema; ausencia de archivos parciales tras un fallo; eventos de progreso y error por archivo; y las imágenes, que entran por una vía propia: destino forzado a `assets/`, nombre saneado aunque traiga ruta, formato restringido y presupuesto respetado. |
| `electron/__tests__/integrated-browser-page-observation.test.ts` | Acotado del payload, URL sin credenciales y ausencia de valores de formulario; y las imagenes de contenido, que conservan su query a proposito (sin ella la descarga devuelve 403) pero pierden las credenciales y descartan `data:`, `blob:` y lo que no sea una URL. |
| `electron/__tests__/skill-workspace-fetch-image.test.ts` | Guardas de la descarga de imágenes, que ejecuta main porque la URL la elige el modelo: solo HTTPS, rechazo de destinos privados y de enlace local **sin emitir la petición**, revalidación de cada redirección (una URL pública que redirige a `169.254.169.254` se corta), cadena de redirecciones acotada, tipo no admitido, límite de tamaño y error de red que no filtra el destino interno. |
| `electron/__tests__/presentation-protocol.test.ts` | El protocolo local solo sirve el workspace indicado, devuelve 404 fuera de la raíz, ante un symlink externo y ante una extensión sin tipo conocido, emite una CSP sin `connect-src` ni orígenes remotos, y registra el handler en **ambas** sesiones: la del renderer y la partición de la vista a pantalla completa. |
| `electron/__tests__/deck-base-css.test.ts` | El sistema de diseno y el guion base, que salen en TODAS las presentaciones: pie en flujo, marco sin deriva vertical ni `zoom`, preservación de alineación y ancho al envolver contenido, contraste automático sobre imagen de fondo, primitivas de diagrama y gráfica, coreografía semántica con Web Animations al activarse la diapositiva, ajuste del contenido a la ventana y estado final con movimiento reducido. |
| `electron/__tests__/presentation-system-refresh.test.ts` | Una baraja persistida con el motor antiguo recibe los protegidos actuales antes de vista previa, pantalla completa o exportación; la operación es idempotente y rechaza un identificador vacío. |
| `electron/__tests__/presentation-export-html.test.ts` | La exportación produce un HTML autocontenido. Cubre tanto HTML heredado como el runtime React: incrusta bundle, contrato, marca e imágenes, conserva módulos, descarta orígenes remotos y no incrusta archivos de fuera del proyecto. |
| `electron/__tests__/organization-branding.test.ts` | Tema neutro sin organización o sin branding habilitado; rechazo de colores que no son colores CSS; ausencia de columnas de suscripción o contacto en la consulta; caché con invalidación por cambio de organización y cierre de sesión; descarga acotada por host, tamaño, timeout y tipo declarado. |
| `electron/__tests__/wa-skills-catalog.test.ts` | Skill no habilitada para la superficie, skill bloqueada en grupos y skill desconocida se rechazan con motivo explícito y sin filtrar la conversación individual. |
| `electron/__tests__/whatsapp-workflow-presentacion.test.ts` | El flujo usa el motor propio, escribe la hoja de marca como sistema, entrega el PDF solo tras la aprobación y no llama a ningún generador externo. |
| `src/__tests__/services/turn-skill-tools.test.ts` | La cadena completa desde "la conversacion tiene una presentacion" hasta "el modelo recibe `workspace_write_file`": deriva la Skill del espacio de trabajo cuando el compositor la perdio, declara las herramientas, corre el bucle, completa el workspace de una Skill recien activada y no declara nada sin presentacion. Cada eslabon estaba bien por separado; lo que fallaba era la union, y el usuario lo vio tres veces como "no puedo acceder a los archivos". |
| `src/__tests__/services/skills-turn-catalog.test.ts` | Sin Skill activa el catálogo es idéntico al base; con workspace vivo se declaran las herramientas; sin workspace no; la allowlist de superficie descarta lo que una Skill no puede aportar. |
| `src/__tests__/components/PresentationWorkspacePanel.test.tsx` | Una imagen se muestra como imagen y NUNCA se pide como texto (leerla bloqueaba la aplicacion); se abre el documento de entrada y no la primera imagen; edicion manual que guarda por el puente, con los archivos del sistema sin boton de editar; y la exportacion abre la carpeta. Ademas: listado y selección de archivos, señal del archivo en curso, error por archivo, progreso de otro workspace ignorado, reproducción deshabilitada hasta que existe el documento, `iframe` sin `allow-same-origin`, ancho ajustable con teclado y persistido con sus límites, y apertura automática de la vista previa al terminar sin arrebatársela al usuario después. |
| `src/__tests__/components/presentation-code-highlight.test.ts` | Resaltado por lenguaje, escapado del marcado del contenido en los tres lenguajes (se pinta con `dangerouslySetInnerHTML`) y cota de tamaño que evita tokenizar un archivo desproporcionado. |
| `src/__tests__/services/renderer-csp.test.ts` | La CSP del renderer permite embeber `pulse-presentacion:` y no abre el embebido a orígenes remotos. Sin `frame-src` explícito la directiva caía a `default-src 'self'` y la vista previa quedaba en blanco. |
| `src/__tests__/services/presentaciones-prompt.test.ts` | El agente recibe el contrato `deck.json`, la frontera HyperFrames/React/Tailwind/Framer Motion, los límites de densidad y la prohibición explícita de escribir HTML, CSS o JavaScript visual. |
| `src/__tests__/services/tool-result-payload.test.ts` | La frontera entre lo que devuelve una herramienta y lo que entra al contexto: la captura sale del texto y se entrega como imagen dejando constancia de que existe, el campo mas pesado se descarta primero diciendo cuanto omitio, un resultado que ya cabe no se toca, y la salida es siempre JSON de objeto (quien la consume la parsea). |
| `src/__tests__/services/openai-workspace-turn.test.ts` | Lo que hacia morir el turno que construye una presentacion: un 429 al abrir el stream ahora se reintenta (y lo que no es transitorio, no), el contenido ya escrito deja de reenviarse en cada iteracion conservando la ruta, los argumentos pequenos quedan intactos, y el turno con workspace vivo recibe mas iteraciones y mas presupuesto de salida que uno de chat. Cubre tambien el 429 que llega LEYENDO el stream (no al abrirlo) y que no se reintenta si ya hubo texto en pantalla, la captura que viaja como imagen y no dentro del JSON de la salida, el descarte de las capturas antiguas y el recorte de los resultados de herramienta antiguos, que es lo que agotaba los tokens por minuto de la organizacion. |
| `src/__tests__/services/skill-workspace-image-tools.test.ts` | Reparto entre renderer y main para las imágenes: el renderer genera y entrega solo base64 (el prefijo `data:` rompería la decodificación en main), no escribe nada si el modelo no devolvió imagen, valida los argumentos antes de gastar una generación, y delega la descarga sin intentar validar la URL por su cuenta. |
| `src/__tests__/components/skill-workspace-resume.test.tsx` | Una conversacion que ya tiene entregable recupera su Skill sola, con la nota de que continua un trabajo; no pisa una Skill activa, no se reimpone si el usuario la desactiva y no falla fuera del escritorio. Sin esto, pedir un cambio sobre la presentacion llegaba al modelo sin herramientas de workspace y respondia que no tenia acceso a los archivos. |
| `src/__tests__/components/SkillLibrary.test.tsx` | Separación entre Skills del sistema y del usuario; las del sistema no ofrecen editar ni eliminar. |
| `electron/__tests__/brand-palette.test.ts` | Extracción de paleta desde el bitmap del logo: color dominante, varios colores por frecuencia, descarte de fondo blanco, negro y píxeles transparentes, logo monocromo sin paleta, agrupación del antialiasing y corrección de contraste sobre fondo claro. |
| `src/__tests__/services/skill-slash-commands.test.ts` | Derivación del comando desde el nombre, comando declarado por la Skill del sistema, precedencia ante duplicados, filtrado por prefijo, coincidencia exacta con y sin acento, y que un texto con espacio deja de ser comando. |
| `src/__tests__/components/SkillsSettingsPanel.test.tsx` | Configuración de Skills: listado con comando, Skills del sistema sin acciones de edición, derivación del comando desde el nombre, aviso y rechazo de comando duplicado, validación de campos obligatorios, creación con icono y comando, y que al editar el comando propio no cuenta como conflicto. |
| `src/__tests__/services/skill-tool-loop.test.ts` | La decisión de activar el bucle de herramientas: una Skill que declara herramientas lo fuerza incluso sobre una observación de solo lectura del navegador, y sin Skill ese caso sigue sin bucle. |
| `src/__tests__/components/ChatInputArea.test.tsx` | El menú de comandos aparece solo con un comando en curso y va en flujo normal, para que el `overflow-hidden` del compositor no lo recorte. |

## SQLite sin ABI nativa

`npm run test` ejecuta Vitest directamente. La persistencia local usa
`node:sqlite`, incluido en el Node que trae Electron, asi que no hay extension
compilada contra la ABI de V8 que reconstruir entre Node y Electron. El
adaptador vive en `electron/sqlite/database.ts` y los errores
`NODE_MODULE_VERSION` de `better-sqlite3` dejaron de ser posibles.

## Piramide por tipo de cambio

| Cambio | Evidencia minima adicional |
|---|---|
| UI | component/hook + teclado/estados manuales + claro/oscuro |
| IPC | handler, preload allowlist, wrapper y casos canal/payload invalido |
| Tool/agente | schema, autorizacion, HITL, group, timeout, loop y redaccion de error |
| Datos | SQL lint/revision, constraint/RLS, migracion forward, preflight y rollback |
| Integracion | no configurada, exito mock, 401/403, 429, 5xx, timeout y desconexion |
| Release | `verify:release`, recursos empaquetados y artifacts esperados |
| Documentacion/arnes | adapters/harness/docs/OpenSpec/link checks |

## Compuertas

- Durante desarrollo: prueba dirigida con `npx vitest run <archivos>`.
- PR: `npm run verify:pr`.
- Release: `npm run verify:release`.
- `lint:changed` bloquea errores solo en TS/TSX modificados; `lint` global puede
  revelar deuda no atribuible y sigue siendo diagnostico util.

## Casos negativos obligatorios

Autenticacion ausente, org/owner equivocado, input extra, canal no allowlisted,
grupo bloqueado, HITL ausente/falsificado, contrato cambiado, timeout/abort,
respuesta parcial, idempotency replay, DB no disponible, provider rate limit y
rollback. No todos aplican a cada cambio; el Context Pack decide.

## Cobertura y deuda

- La configuracion tiene comando de coverage, pero no umbral global ni por modulo.
- No hay mutation testing, axe, visual regression ni performance budget en CI.
- Tests por inspeccion de source son utiles para invariantes, pero no sustituyen
  ejecutar el comportamiento.
- Nombres legacy AutoDev en tests no demuestran servicio runtime activo.
- Cada reporte debe separar fallo introducido, fallo preexistente y gate no
  ejecutado; nunca convertir warnings en “todo aprobado”.
