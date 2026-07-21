# Evidencia de implementación

Fecha: 2026-07-21
Rama: `codex/harness-foundation`

## Resultado

El registro de herramientas dinámicas quedó gobernado para el consumidor
`whatsapp-agent`: contratos cerrados, política obligatoria, validación Zod de
entrada/salida, permisos por agente/grupo, HITL, timeout cancelable, huella contra
hot reload y auditoría minimizada. Home Assistant fue migrado al contrato.

No se agregó IPC, tabla, variable de entorno ni dependencia.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `npx openspec validate enforce-runtime-tool-policies --strict --no-interactive` | válido, 4/4 artefactos |
| `npx vitest run electron/__tests__/mcp-manager.test.ts electron/__tests__/whatsapp-tool-executor.test.ts electron/__tests__/dynamic-tool-home-assistant.test.ts` | 3 archivos, 51 pruebas aprobadas |
| `npm run typecheck` | aprobado para renderer y main |
| `npm run lint:changed` | aprobado, sin incidencias nuevas |
| `npm run docs:check` | 70 Markdown activos, enlaces válidos |
| `npm run verify:pr` | aprobado; 104 archivos y 962 pruebas |
| `npm run build:app` | build renderer/main/preload aprobado |
| `git diff --check` | aprobado |

El build conserva advertencias preexistentes: imports simultáneamente estáticos y
dinámicos en tres servicios, y bundle renderer principal de aproximadamente
2.06 MB. No son regresiones de este cambio.

## Revisión adversarial

| Vector | Comprobación / mitigación |
|---|---|
| Plugin legacy sin metadata | El loader lo rechaza; no aparece en declaraciones ejecutables. |
| Propiedades extra o entrada opaca | Zod estricto falla antes del handler. |
| Salida fuera de contrato | Se bloquea antes de devolverla al agente. |
| Agente no permitido | `agent_denied` central, aun con llamada directa. |
| Chat grupal no permitido | `group_denied` central; no depende de la lista estática. |
| Modelo intenta autoaprobar | La aprobación no forma parte de args y solo la crea el host. |
| `skipConfirmations` en tarea pasiva | No salta HITL para plugins dinámicos. |
| Hot reload después del “SI” | Huella de contrato distinta produce `contract_changed`. |
| Handler bloqueado | Timeout devuelve control y aborta `AbortSignal`. |
| Secreto en argumento/resultado/error | Auditoría no serializa payloads y los fallos del handler se generalizan. |
| Rutas locales en respuestas | Inventario, doctor, instalación y desinstalación solo exponen scope/nombres. |
| Skill de desarrollo colocada en el repo | No se descubre fuera de directorios runtime configurados. |

## Riesgos residuales

- Los módulos JavaScript/TypeScript son código confiable del workspace o de
  toolsets builtin administrados; este incremento gobierna el handler, no crea un
  sandbox de módulos. Agregar fuentes remotas requerirá un cambio OpenSpec propio.
- El timeout es cooperativo para I/O: un handler síncrono que bloquee el event loop
  no puede ser interrumpido por `AbortSignal`.
- La auditoría se emite como evento y log estructurado del proceso principal; la
  persistencia durable y su política de retención quedan para una fase posterior.

## Rollback

Revertir este cambio y reinstalar Home Assistant restaura los archivos generados
anteriores. No hay migraciones de datos o acciones externas que revertir. Durante
rollback, los toolsets legacy vuelven a ser aceptados, por lo que no debe usarse
como solución permanente a un contrato inválido.
