# Verificación: pestañas y fuentes citables

Fecha: 2026-09-09. Cambio: `complete-integrated-browser-platform`.
Worktree: `.worktrees/upgrade-integrated-browser`, rama `codex/upgrade-integrated-browser`.
Se preservaron cambios existentes y no se hicieron commits, despliegues ni SQL remoto.

## Resultado

Cierra **6.3**. Progreso **52/64**, **12 pendientes**.

- Selector `@` y menú con búsqueda por título/sitio, navegación de teclado,
  selección múltiple acotada a ocho, reintento y consentimiento visible sobre
  enviar extractos al modelo y conservarlos con el chat. Sin favicons externos.
- Recibo de documento/perfil, validación main antes y después de autorización,
  rechazo de documentos sustituidos y marcos ajenos. Token renovado al crear
  vista o navegar, incluida navegación interna y comienzo de navegación principal.
- Lectura nueva, hasta 3000 caracteres por pestaña antes de IPC, tres fragmentos
  de 1000; bloque serializado máximo 60.000 caracteres y presupuesto compartido
  con otros adjuntos. Texto vacío o lectura incompleta conserva el borrador.
- Preparación serial con plazo de quince segundos y revalidación final del lote.
  Exclusión de doble envío, descarte tras cancelar/cambiar contexto/desmontar.
  No interpreta fallo como «información cargada» ni reutiliza texto de chips.
- Metadata `sources` existente conserva fragmento, identificador, título, URL
  saneada y fecha. Reapertura y regeneración preservan esa evidencia histórica;
  editar inicia un turno nuevo sin los adjuntos previos. Citas visibles por
  identificador, extractos desplegables y advertencias sobre citas sin fuente
  asociada o respuestas sin citas.
- `attached-fragments` desactiva observación implícita, documento activo y
  búsquedas/herramientas hospedadas en ambos proveedores. Sólo mantiene las
  herramientas del workspace de una Skill elegida, excluyendo descargas; el
  despacho también rechaza invocaciones fuera del catálogo limitado.

## Evidencia ejecutada

| Comando / alcance | Resultado |
|---|---|
| `npm run test -- integrated-browser browser-tab-sources attachment-preparation BrowserTabSources ChatInputArea chat-selection-attachment process-message-settle gemini-chat-routing gemini-chat.test skill-tool-loop openai skills-turn-catalog` | 911 casos, 64 archivos, aprobados |
| `npm run test -- src/__tests__/services/openai-workspace-turn.test.ts src/__tests__/services/browser-tab-sources.test.ts electron/__tests__/preload.test.ts` | 72 casos, 3 archivos, aprobados después de dos casos adicionales; se solapan con la regresión, no sumar |
| Dirigidas main/handler/preload/wrapper/compositor/procesamiento/rutas/Skill | 314 casos, 12 archivos, aprobados antes de la regresión ampliada |
| `npm run lint:changed` | 215 archivos sin deuda nueva en la repetición final |
| `npm run typecheck` | Aprobado en renderer y main |
| `git diff --check` | Aprobado, salida 0 |
| `npx openspec validate complete-integrated-browser-platform --strict` | Aprobado |
| `npm run verify:pr` | Bloqueado en `skills:seed:check`; no equivale a PR aprobada |

La compuerta aprueba adaptadores (27), harness (25 rutas/9 skills), cadena de
suministro, documentación de sistema (28 documentos, 150 IDs, 419 canales,
444 archivos de prueba) y enlaces (275 documentos activos). Después detecta la
discrepancia preexistente entre `database/lia/migrations/system-skills-catalog.sql`
y `src/shared/skills/registry.ts`, sin cambios de este corte. No se reescribió esa
semilla para ocultar el bloqueo; la suite global de `verify:pr` no llegó a ejecutarse.
Al añadir este reporte, `docs:check` confirma 276 documentos activos y
`docs:system:check` vuelve a aprobar las cifras. La revisión de whitespace
detectó una línea vacía al final de los chips retirados; se corrigió sin
modificar configuración de Git ni ocultar avisos de conversión CRLF.

## Revisión adversarial

Se intentó refutar aislamiento de perfil/documento, contenido fresco, límites,
cancelación, exclusión de dobles clics, redacción de URL y procedencia persistida.
Un test inicial contó toda ejecución JavaScript de la vista, incluido el vigía
de selección asíncrono; se corrigió para observar la extracción DOM específica,
sin debilitar la expectativa de que una selección obsoleta no lee contenido.
Lint detectó estado síncrono dentro de efectos nuevos; se sustituyó por estado
ligado al contexto y actualizaciones de eventos, sin desactivar reglas.

Se encontró y corrigió una ampliación implícita de fuentes: el router podía
capturar la pestaña activa a partir de palabras del extracto. Ahora el alcance
se transporta como opción tipada independiente del texto, con límites en ambos
catálogos y en el dispatcher. Pruebas negativas cubren intentos de navegación,
Computer Use y descarga no declarada, sin ejecutar esas acciones.

## Límites y recuperación

- Son extractos del texto DOM disponible, no lectura completa/semántica de PDF,
  Google Docs u otros lienzos; la UI permite inspeccionar la evidencia. No se
  certifica que la conclusión esté respaldada semánticamente por la cita.
- El token detecta navegación/vista/perfil, no toda mutación autónoma del DOM.
  Las fuentes son instantáneas históricas, no una transacción entre páginas.
- Cancelar descarta resultados y evita la siguiente lectura/envío; un IPC o
  diálogo nativo ya emitido puede terminar. No cierra 6.4 ni ofrece pausa real.
- Adjuntar guarda texto con el chat y sus reglas de acceso/compartición, no con
  la bitácora cifrada del navegador. No equivale a E2EE ni preservación de datos
  privados después de enviarlos explícitamente al chat. URLs sin query pueden
  no reabrir exactamente el documento original.
- Ante fallo no se borra el borrador: quitar o volver a seleccionar la pestaña.
  Para revertir este corte, retirar el cableado del modo y selector conservando
  la metadata opcional de mensajes; no borrar chats ni restaurar stores.
- No se ejecutó el producto completo ni instalador Windows, ni producción Lia.

## Pendientes reales

2.5 zoom realmente aislado; 4.8 autenticación del SO/bloqueo de bóveda y
formularios avanzados; 4.10 passkeys; 5.6 permisos de extensiones por sitio;
5.7 catálogo/editor/actualizaciones de extensiones; 6.4 pausa/detención/toma
de control end-to-end; 6.5 handoff sensible; 6.7 atajos agénticos;
6.8 índice semántico; 6.9 voz de Orbe; 8.7 migraciones/rollback de stores
restantes; 9.5 smoke completo/instalador y validación Lia entre equipos reales.
