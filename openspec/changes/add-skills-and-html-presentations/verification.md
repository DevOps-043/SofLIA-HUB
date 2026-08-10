# Verificación

Estado: automatizada completa; manual pendiente (12.3 y 12.4).
Fecha: 2026-08-07.

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
