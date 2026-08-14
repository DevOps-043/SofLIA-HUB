# Verificación

Estado: automatizada completa; manual pendiente (12.3 y 12.4).
Fecha: 2026-08-07.

## Revalidación de calidad editorial y maquetación (2026-08-13)

Se probó el motor actualizado sobre la carpeta real `Presentacion/` que
reproducía los lienzos vacíos y el texto desplazado. El humo visual ejecutó
Chrome en 1440×810, 1024×768 y 1440×810 con movimiento reducido. En los
tres escenarios hubo **cero** incidencias de contenido fuera del lienzo; las
diapositivas 2 y 5, antes vacías, quedaron completas y navegables. La auditoría
sí rechazó la baraja antigua por titulares de más de tres líneas y por factores
inferiores a 0.82: esa evidencia confirma que la nueva compuerta distingue un
fallo de motor de una composición editorial que debe rehacerse.

| Comando | Resultado |
|---|---|
| `npm run test -- --run electron/__tests__/deck-base-css.test.ts src/__tests__/services/presentaciones-prompt.test.ts src/__tests__/components/PresentationWorkspacePanel.test.tsx` | 3 archivos, **83 pruebas**, todas en verde. |
| `npm run lint:changed` | Sin deuda nueva en los archivos TypeScript modificados. |
| `npm run docs:check` | 174 documentos válidos. |
| `npm run harness:validate` | Arnés válido. |
| `npm run openspec:validate` | 14 cambios válidos en modo estricto. |
| `npm run verify:pr` | Bloqueado en `typecheck` por errores preexistentes y ajenos de portapapeles e instaladores de Windows; no hay diagnósticos en los archivos de este cambio. |

Reejecución final del alcance dirigido: 5 archivos, **122 pruebas** en verde.
`docs:check` validó 174 documentos, `harness:validate` validó 25 rutas y 8
skills, `openspec:validate` validó los 14 cambios y `lint:changed` revisó 12
archivos sin deuda nueva. `typecheck` sigue bloqueado por los mismos errores
ajenos en portapapeles e instaladores de Windows.

### Segunda reproducción: baraja Okra y motor persistido

Las nueve capturas de regresión pertenecían a una baraja de 14 diapositivas
creada con una copia persistida de `guion-base.js` que aún contenía
`caja.style.zoom`. Por eso el defecto seguía apareciendo aunque el código fuente
del motor ya hubiera cambiado: los protegidos se copiaban al crear el workspace,
pero nunca se actualizaban al volver a abrirlo.

Se reemplazaron **solo en una copia temporal** los dos protegidos por la versión
actual y se renderizaron todas las diapositivas con Chrome real:

| Escenario | Diapositivas | Contenido fuera del lienzo | Animaciones activas a los 120 ms | Factor mínimo |
|---|---:|---:|---:|---:|
| 1920×1080 | 14 | **0** | 2–12 por diapositiva | 0.784 |
| 1024×768 | 14 | **0** | 88 en total | 0.543 |
| 1920×1080, movimiento reducido | 14 | **0** | **0** | 0.784 |

La segunda diapositiva conservó un marco de 1728 px y dejó de colapsar a una
columna estrecha; el marco copia la alineación calculada de la diapositiva y se
estira al ancho completo. La diapositiva 14, cuyo HTML omitía
`.diapositiva--imagen`, recibió contraste de fondo automáticamente. Las
diapositivas 8, 9 y 14 siguen marcadas con `ajuste-excesivo`: ya no se recortan,
pero su densidad editorial debe corregirse, por lo que la auditoría no las
presenta como una entrega limpia.

La corrección añade actualización idempotente del motor antes de vista previa,
pantalla completa y exportación. También sustituye las variaciones arbitrarias
del modelo por una coreografía semántica de Web Animations; el modelo declara
roles y el sistema conserva curva, duración, orden y reducción de movimiento.

La revisión adversarial detectó que tres aperturas concurrentes podían compartir
el mismo nombre temporal durante el refresco. Se corrigió con un temporal UUID y
limpieza en `finally`, y se añadió una prueba que dispara tres refrescos a la vez
sin dejar `.parcial`. También se hizo estricto el fallo en vista previa: si el
motor no puede actualizarse, se informa el error en vez de servir silenciosamente
la versión defectuosa.

**Decisión de librería/modelo.** Reveal.js resuelve un lienzo lógico fijo y
escalado uniforme y dispone de transiciones/Auto-Animate, pero adoptarlo ahora
exigiría migrar el contrato HTML completo y empaquetar sus recursos localmente.
GSAP aporta líneas de tiempo avanzadas, no corrige maquetación. Para este cambio
se usa la Web Animations API ya disponible en Chromium: preserva el HTML
autocontenido y no añade CDN ni bundle. Tampoco se fuerza un modelo más costoso:
la causa del desplazamiento era determinista y estaba en el motor. Un cambio de
modelo queda para una comparación A/B posterior, con la misma fuente y la misma
rúbrica, si persisten los avisos de densidad narrativa.

## Compuertas ejecutadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Sin errores (`tsconfig.json` y `tsconfig.node.json`). |
| `npm run test` | 162 archivos, **1451 pruebas**, todas en verde. |
| `npm run harness:validate` | Arnés válido: 25 rutas y 8 skills canónicas. |
| `npm run lint:changed` | 147 archivos revisados sin deuda nueva. |
| `npm run docs:system:check` | 28 documentos, 147 IDs, 335 canales y 338 archivos de prueba. |
| `npm run verify:pr` | **Compuerta de PR completada.** |
| `npx vite build` | Bundles main, preload y renderer construidos. |

## Suites nuevas del cambio

| Suite | Casos |
|---|---|
| `electron/__tests__/skill-workspace-paths.test.ts` | 17 |
| `electron/__tests__/skill-workspace-service.test.ts` | 23 |
| `electron/__tests__/presentation-protocol.test.ts` | 14 |
| `electron/__tests__/organization-branding.test.ts` | 20 |
| `electron/__tests__/wa-skills-catalog.test.ts` | 10 |
| `electron/__tests__/whatsapp-workflow-presentacion.test.ts` | 19 (reescrita al motor propio) |
| `src/__tests__/services/skills-turn-catalog.test.ts` | 14 |
| `src/__tests__/components/PresentationWorkspacePanel.test.tsx` | 12 |
| `src/__tests__/components/SkillLibrary.test.tsx` | 8 |
| `electron/__tests__/brand-palette.test.ts` | 16 |
| `src/__tests__/services/skill-slash-commands.test.ts` | 15 |
| `electron/__tests__/preload/channel-cases.ts` | +2 casos (SEC-036, SEC-037) |

## Revisión adversarial

Hipótesis que se intentaron refutar y resultado:

### Hallazgo 1 — Entorno completo inlineado en un chunk de main (corregido)

`src/shared/skills/registry.ts` leía `import.meta.env` como objeto para
resolver la bandera de la Skill. Como ese módulo es compartido y el proceso
main se empaqueta a **CJS**, el bundler sustituyó la expresión por el objeto de
entorno **completo**, con las claves de API reales, dentro de
`dist-electron/whatsapp-agent-*.js`. Además `readEnv()` hacía
`{...process.env, ...importMetaEnv}`, de modo que el valor congelado en build
**ganaba** sobre el `process.env` real: la bandera de rollback habría quedado
fija en el valor del build.

Evidencia previa a la corrección:

```
grep -o "function wt(.\{0,260\}" dist-electron/whatsapp-agent-*.js
function wt(){let e=typeof process<`u`&&process.env?process.env:{},t=Tt();return{...e,...t}}
function Tt(){try{return{BASE_URL:`/`,DEV:!1,MODE:`production`,PROD:!0,SSR:!1,
VITE_CHAT_TTS_PROVIDER:`google-cloud`,VITE_GEMINI_API_KEY:`AIza…`,VI…
```

Corrección: el registro ya no lee `import.meta`. Recibe el entorno por
parámetro y cada superficie pasa el suyo — main entrega `process.env` en cada
llamada, el renderer un mapa con la clave concreta
(`src/services/skills/skill-flags.ts`). El valor por defecto es `{}`, de modo
que sin entorno explícito ninguna Skill con bandera queda habilitada.

Evidencia posterior:

```
grep -rl "BASE_URL:\`/\`,DEV:" dist-electron/   → (vacío)
grep -o "featureFlag\].\{0,60\}" dist-electron/whatsapp-agent-*.js
featureFlag];return n===`true`||n===`1`}function St(e,t={}){return bt.fi…
```

Regresión cubierta por dos casos nuevos en `wa-skills-catalog.test.ts`: la
bandera se relee del entorno en cada consulta, y el registro sin entorno no
habilita nada.

### Hallazgo 2 — Requisito de uso declarado pero no implementado (corregido)

`skills-registry/spec.md` exige registrar el uso de cada Skill para poder
ordenarlas. `markUserSkillUsed` existía pero nunca se invocaba. Se cableó en
la activación (`useChatTools.handleUseSkill`), sin bloquear la activación si
la escritura falla.

### Hallazgo 3 — Superficie muerta (corregido)

`isWorkspaceAvailable`, `emptySkillCatalog`, `findSkillInCatalog`,
`skillTools`, `skillWorkspace` y `PresentationWorkspaceValue.clear` estaban
exportados sin ningún consumidor. Eliminados: una API no ejercitada no tiene
prueba que la respalde.

### Hipótesis refutadas (sin hallazgo)

| Hipótesis | Verificación |
|---|---|
| El modelo puede escapar del workspace | Rechazado por `..`, ruta absoluta, enlace simbólico a archivo y a carpeta, y hermano con prefijo común. La contención usa `realpath`, no comparación textual. 17 casos contra el sistema de archivos real. |
| El modelo puede reescribir la hoja de marca | `writeFile`, `editFile` y `deleteFile` rechazan los archivos protegidos; solo `writeSystemFile` los admite y su único llamador es el handler de branding, con la ruta escrita en el código. |
| El renderer puede escribir una ruta de marca arbitraria | La ruta `estilos/marca.css` está fija en `skill-workspace-handlers.ts`; el payload solo aporta workspace y organización. |
| El modelo puede borrar archivos | No existe herramienta de borrado en `SKILL_WORKSPACE_TOOL_NAMES`. |
| Las herramientas de workspace se ofrecen sin workspace | `resolveSkillToolNames` las filtra si `workspaceId` es nulo; probado que el catálogo sin Skill es idéntico al base. |
| Una Skill puede ampliar los permisos de su superficie | `NEVER_FROM_SKILLS` y la allowlist por superficie descartan `use_computer`, `execute_command`, `gmail_send` y `whatsapp_send_file` aunque se declaren. |
| Una fila de la base de datos puede pasar por Skill del sistema | La clase se fija literalmente al mapear la fila y `catalog.ts` descarta identificadores reservados. |
| El documento servido puede alcanzar IPC o la red | `iframe` con `sandbox="allow-scripts"` sin `allow-same-origin`; CSP sin `connect-src`; vista nativa sin preload y en partición propia. |
| El protocolo sirve archivos fuera del workspace | 404 para ruta fuera de la raíz, workspace inexistente, enlace simbólico externo, extensión sin tipo conocido y otro protocolo. |
| La vista de compatibilidad permite escritura | La vista no declara triggers `INSTEAD OF`, por lo que es de solo lectura, y usa `security_invoker` para heredar el RLS de `skills`. |
| Un fallo a mitad de escritura deja un archivo parcial | Escritura atómica con archivo temporal y `rename`; probado con `fs.rename` forzado a fallar. |
| El flujo de WhatsApp sigue llamando a un tercero | Caso WA-164: ninguna petición contiene `gamma`. `gamma.ts` eliminado y `VITE_GAMMA_API_KEY` retirada de CI, README y configuración. |

## Riesgo residual

1. **La migración no se ha ejecutado.** `database/lia/migrations/skills-registry.sql` está escrita y es idempotente, pero requiere ejecución autorizada en Supabase LIA. La tarea 12.6 (conteo por usuario antes y después) solo puede completarse con esa ejecución real.
2. **Sin validación manual end-to-end** (tareas 12.3 y 12.4): generar desde un archivo adjunto, ver el código en vivo, reproducir, iterar, exportar y recibir el PDF por WhatsApp. Las pruebas usan dobles del puente de preload; no sustituyen una corrida en la aplicación empaquetada.
3. **La invocación por `/` no tiene prueba de integración con el compositor.** Se prueba el resolutor (derivación del comando, filtrado, coincidencia exacta, precedencia) y que el compositor no rompe sin comandos activos, pero no el recorrido completo teclado → menú → activación en un render real.
4. **El protocolo de recolección es prompt, no código.** Que SofLIA pregunte antes de generar depende de que el modelo siga el protocolo; la nota de contexto le dice en qué rama está, pero nada le impide técnicamente escribir archivos en el primer turno.
5. **La paleta del logo solo se prueba sobre bitmaps sintéticos.** El extractor tiene 16 casos, pero `nativeImage` decodificando un PNG real no se ejercita: si Electron devolviera el bitmap en otro orden de canales, las pruebas seguirían pasando.
6. **La calidad del HTML depende del modelo.** El contrato de salida es un prompt, no un validador: no se comprueba automáticamente que el documento generado enlace `estilos/marca.css` ni que evite recursos remotos. La CSP lo bloquea en ejecución, pero el fallo se vería como una presentación sin estilos, no como un error explícito.
7. **`script-src 'unsafe-inline'`** es deliberado para la navegación entre diapositivas. La mitigación es el entorno (origen opaco, sin preload, sin red), no la revisión del script.
8. **La Skill sale deshabilitada por defecto.** `VITE_SKILL_PRESENTACIONES_ENABLED` debe activarse explícitamente en cada entorno; sin ella, `/presentacion` responde que no está disponible.
9. **`electron/presentation-pdf/`** conserva su tubería de markdown para otros flujos; la exportación de presentaciones no la reutiliza y podría divergir con el tiempo.

## Runtime React + HyperFrames (2026-08-13)

Se reemplazó la autoría libre de geometría por `deck.json` y se verificó el
reproductor React a 1920×1080 con cinco capturas reales en Chrome: portada,
comparación, proceso, métricas y cierre. Ninguna mostró texto fuera del lienzo,
columnas colapsadas o desplazamiento vertical. La revisión adversarial intentó
refutar aislamiento, contrato y portabilidad: rutas fuera de allowlist reciben
404; un deck malformado se rechaza antes de abrir; la exportación falla si falta
una imagen y, en el caso válido, embebe bundle, marca, contrato e imágenes.

| Comando | Resultado |
|---|---|
| `npx vitest run …` (9 suites focalizadas) | **113 pruebas** en verde. |
| `npm run typecheck` | Sin errores en renderer, main ni preload. |
| `npm run lint:changed` | 22 archivos sin deuda nueva. |
| `npm run harness:validate` | 25 rutas y 9 skills canónicas. |
| `npm run docs:check` | 189 Markdown activos, enlaces válidos. |
| `npm run docs:system:check` | 28 documentos, 150 IDs, 346 canales y 374 archivos de prueba. |
| `npm run openspec:validate` | 17 cambios válidos, 0 fallos. |
| `npx vite build --config vite.config.mts` | Renderer, main y preload construidos. |
| `npm run verify:pr` | No completó: `npm test` excedió 5 minutos sin aserción fallida y dejó un worker Vitest activo; se terminó el worker creado por la compuerta. |

Riesgo residual específico: los workspaces heredados con `index.html` conservan
su motor anterior durante la migración. El nuevo runtime no ejecuta HTML, CSS o
JavaScript escrito por el modelo.

### Cierre verificable del entregable

El incidente posterior mostro un workspace con `guion.md`, imagenes y archivos
del motor heredado, pero sin `deck.json`; el modelo habia respondido que ya
ejecuto las acciones. Ahora OpenAI y Gemini consultan `getState` antes de aceptar
el cierre, la escritura rechaza decks invalidos y los workspaces React nuevos
solo reciben la hoja de marca. Las pruebas focalizadas incluyen el caso exacto
en que el primer mensaje dice que termino, el estado responde `ready:false`, el
modelo escribe el deck y solo entonces se publica el mensaje final.

La revisión adversarial detectó y corrigió que el refresco del motor HTML podía
intentar recrear `base.css` y `guion-base.js` en un workspace React. El refresco
ahora es un no-op para `deck.json`, con prueba negativa específica.

### Gráficas, microinteracciones y vista previa aislada (2026-08-13)

El contrato suma el arquetipo `grafica` con barras, líneas, área, radar y anillo;
el runtime lo representa con Recharts y carga esa biblioteca de forma diferida.
Framer Motion añade respuesta al cursor en tarjetas, procesos, métricas, llamadas
a la acción e imágenes de recorte, respetando `prefers-reduced-motion`. Las
imágenes configuradas como `contener` no se amplían para evitar recortar evidencia.

La pantalla blanca de la vista previa tenía dos causas reproducidas: el lienzo
todavía no existía cuando se instalaba `ResizeObserver`, y el bundle común
importaba `App.tsx`/Supabase dentro de un iframe sin `allow-same-origin`. El
contenedor ahora se monta desde el estado incompleto y la entrada usa imports
dinámicos excluyentes. Una prueba real de Chrome cargó la URL del reproductor en
`<iframe sandbox="allow-scripts">`, mostró la primera diapositiva y produjo cero
errores de consola, sin ampliar los permisos del sandbox.
La revisión adversarial redujo además el CORS de Vite de `*` al único origen
necesario (`null`), conservando la carga del sandbox sin exponer el servidor de
desarrollo a lecturas desde orígenes web arbitrarios.

| Comando o prueba | Resultado |
|---|---|
| `npm run typecheck` | Sin errores. |
| `npx vitest run` (5 suites dirigidas) | **43 pruebas** en verde. |
| `npm run build:app` | Renderer, main y preload construidos; runtime y Recharts quedaron en chunks separados. |
| Chrome real, iframe opaco 1100×620 | Primera diapositiva visible, un solo `article`, cero errores de consola. |

`npm run verify:pr` superó adaptadores, arnés, cadena de suministro,
documentación, semilla, OpenSpec, tipos y lint; no terminó porque `npm test`
mantuvo un worker Vitest activo por más de seis minutos sin emitir una aserción
fallida. Se cerraron únicamente los procesos creados por esa compuerta. Las cinco
suites focalizadas sí finalizaron y el defecto del iframe se verificó además con
Chrome real.

### Regresion CORS de `deck.json` (2026-08-13)

El mensaje `No se puede reproducir deck.json: Failed to fetch` no provenia del
contrato ni de las imagenes. El servidor loopback respondia CORS unicamente para
el origen opaco `null`; la ventana React de desarrollo corre en el origen Vite y
el navegador bloqueaba su lectura. El servidor ahora autoriza `null` para el
iframe y refleja solo el origen exacto configurado en `VITE_DEV_SERVER_URL`, con
`Vary: Origin`. Una solicitud desde un origen ajeno sigue sin recibir CORS.

| Comando o prueba | Resultado |
|---|---|
| `npm run test -- --run electron/__tests__/presentation-runtime-server.test.ts` | 4 pruebas en verde: sesion opaca, origen Vite, origen ajeno y contencion de recursos. |
| `npm run typecheck` | Sin errores en renderer, main ni preload. |

### Regresión de vista previa embebida (2026-08-13)

La vista previa seguía vacía aun cuando `deck.json` era válido porque la CSP del
renderer no autorizaba el servidor loopback del reproductor. Además, el iframe
usa un origen opaco por su sandbox y los módulos servidos por Vite podían quedar
en caché con un encabezado CORS ligado al origen de la ventana principal. La CSP
ahora admite únicamente `pulse-presentacion:` y `http://127.0.0.1:*` como
fuentes de frame. En desarrollo, Vite sirve sus módulos sin credenciales con
`Access-Control-Allow-Origin: *` y `Cache-Control: no-store`; el servidor de
presentaciones de producción conserva su política estricta de origen exacto o
`null`.

| Comando o prueba | Resultado |
|---|---|
| `npm run test -- --run src/__tests__/services/renderer-csp.test.ts electron/__tests__/presentation-runtime-server.test.ts src/__tests__/components/PresentationWorkspacePanel.test.tsx` | **32 pruebas** en verde. |
| `npm run typecheck` | Sin errores. |
| `npm run build:app` | Renderer, main y preload construidos. |
| Vista previa real en Electron | Diapositivas `01 / 12` y `02 / 12` visibles en orden; sin `Failed to fetch`. |
| `npm run verify:pr` | Las etapas anteriores a la suite global pasaron; el comando excedió cuatro minutos en `npm test`, sin aserción fallida, por el worker Vitest persistente ya documentado. |

### Visuales documentales y web fuente-primero (2026-08-13)

El turno de presentaciones materializa antes de llamar al proveedor una selección
acotada de visuales observados. Los adjuntos visuales se escriben y las imágenes
de contenido web se descargan mediante las guardas existentes del workspace;
el modelo recibe rutas `assets/` verificadas y usa generación solo para cubrir
conceptos sin visual de fuente. La lectura Office conserva texto y tablas del
sidecar y añade la vista actual sin convertir un fallo de captura en fallo del
documento. El prompt inicial exacto de la interfaz, “presentación de la página
que tengo abierta”, activa esta observación aunque no incluya un verbo de lectura.

| Comando o prueba | Resultado |
|---|---|
| `npm.cmd run test -- --run src/__tests__/services/presentation-source-visuals.test.ts src/__tests__/services/gemini-chat-routing.test.ts src/__tests__/services/app-attachments.test.ts src/__tests__/services/presentaciones-prompt.test.ts electron/__tests__/desktop-context-cascade.test.ts` | **67 pruebas** en verde. |
| `npm.cmd run typecheck` | Sin errores en renderer, main ni preload. |
| Revisión adversarial | Las rutas son estables por recurso; el manifiesto no expone queries, fragmentos ni URL de imagen; si todas las importaciones fallan conserva `failed` y permite generación complementaria. |

## Evidencia pendiente de la migración (tarea 12.6)

Registrar tras la ejecución autorizada:

```sql
-- Antes
SELECT user_id, count(*) FROM public.user_tools GROUP BY user_id ORDER BY user_id;
-- Después
SELECT user_id, count(*) FROM public.skills GROUP BY user_id ORDER BY user_id;
-- Vista de compatibilidad
SELECT (SELECT count(*) FROM public.skills), (SELECT count(*) FROM public.user_tools);
```
