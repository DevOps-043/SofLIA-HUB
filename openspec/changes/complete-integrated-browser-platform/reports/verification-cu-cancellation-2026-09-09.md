# Verificación: detención de tareas visuales

Fecha: 2026-09-09. Cambio: `complete-integrated-browser-platform`.
Worktree: `.worktrees/upgrade-integrated-browser`, rama `codex/upgrade-integrated-browser`.
Estado: avance parcial de 6.4; **52/64 tareas completas, 12 abiertas**.
Se preservó el trabajo existente, sin commits, despliegues, secretos ni cambios de base de datos.

## Implementado

- Reserva exclusiva por servicio antes de abrir el navegador CU, ID propio en
  estado y tareas activas, aborto por ID/global y vínculo con la señal del
  solicitante. No sobrescribe el estado de otra tarea de escritorio.
- Apertura revalida perfil, pestaña y control. Cancelar retira la espera de
  viewport; una evaluación de navegación tardía no carga su destino. Una
  navegación nativa ya iniciada conserva la reserva hasta terminar.
- Loop y cliente transmiten la señal al SDK. Las esperas del modelo y HITL
  terminan localmente aunque no respondan, sin ejecutar respuestas tardías.
  Se limpian listeners y se absorben rechazos tardíos, con mensaje saneado.
- `Detener todo` retira también la cola, limpia sus temporizadores/listeners
  y resuelve cada solicitud cancelada; no la ejecuta después de detener.
- Los outcomes conservan ID y estado cancelado, en lugar de anunciar éxito.
  No se agregaron canales IPC ni controles visuales que prometan pausa.

## Evidencia

| Comando | Resultado |
|---|---|
| `npm run test -- desktop-agent gemini-cu integrated-browser-service integrated-browser-cu-driver preload` | 492 pruebas, 30 archivos, aprobados |
| `npm run typecheck` | Aprobado, renderer y main |
| `npm run lint:changed` | 224 archivos, sin deuda nueva |
| `npx openspec validate complete-integrated-browser-platform --strict` | Aprobado |
| `git diff --check` | Aprobado, salida 0 |
| `npm run verify:pr` | Bloqueado en discrepancia preexistente de `skills:seed:check` |

Antes del bloqueo, la compuerta aprobó adaptadores (27), harness (25 rutas,
9 skills), cadena de suministro, documentación de sistema (28 documentos,
150 IDs, 419 canales y 445 archivos de prueba) y enlaces documentales.
La semilla `database/lia/migrations/system-skills-catalog.sql` y su registro
`src/shared/skills/registry.ts` no se modificaron en este corte. No llegó a
ejecutarse la suite global de esa compuerta; no equivale a PR aprobada.

Las primeras verificaciones detectaron tipos de fixtures incompletos, dos
variables no utilizadas y un `any` nuevo; se corrigieron sin desactivar reglas.
El inventario documental se actualizó con la cifra derivada por el validador.

## Revisión adversarial

Se verificaron cancelación previa al arranque, apertura pendiente, cancelación
específica sin afectar otros backends, rechazo de segunda tarea mientras drena
la primera, ID ajeno, tarea de escritorio con el mismo texto, limpieza de
listeners, doble aborto, proveedor/confirmación que nunca responde, respuesta
y error tardíos, viewport tardío y navegación emitida frente a navegación aún
en evaluación. Se corrigió además la cola residual que podía ejecutarse tras
`Detener todo`. Los resultados cancelados no emiten éxito de tarea.

Son pruebas automatizadas con dobles de Electron/proveedor. No se envió una
solicitud real al modelo ni se ejecutó el recorrido completo del producto.

## Límites y recuperación

- 6.4 permanece abierta: faltan pausa/reanudación segura, controles dedicados
  para tomar control y retirar todos los avisos obsoletos, más smoke de producto.
- No se deshace entrada o navegación ya emitida. Una operación nativa o apertura
  de navegador externo que no termine puede conservar la reserva; no se mata
  el proceso ni se cierra la sesión del usuario automáticamente.
- El SDK admite `GenerateContentConfig.abortSignal`, pero documenta cancelación
  del lado del cliente, no cancelación del cómputo o cargos del servicio:
  [contrato oficial de Google Gen AI](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).
- La cancelación de una espera HITL impide actuar, pero no acredita que todos
  los diálogos nativos desaparezcan visualmente. No introduce handoff sensible.
- No cambia persistencia ni requiere migración. Revertir sólo este cableado y
  sus pruebas conserva perfiles, chats, cookies y bóvedas; no borrar stores ni
  revertir el resto del worktree. Retirar la corrección reabre el defecto.

## Pendientes

2.5 zoom aislado; 4.8 autenticación del SO/bloqueo de bóveda y formularios;
4.10 passkeys; 5.6 permisos de extensiones por sitio; 5.7 catálogo/editor y
actualizaciones de extensiones; 6.4 pausa/detención/toma de control completa;
6.5 handoff sensible; 6.7 atajos agénticos; 6.8 índice semántico; 6.9 voz de
Orbe; 8.7 migraciones/rollback de stores restantes; 9.5 smoke completo,
instalador y validación Lia Auth/RLS con dos equipos reales.
