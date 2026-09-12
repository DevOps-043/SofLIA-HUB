# Verificación: supervisión del agente integrado

Fecha: 2026-09-10. Cambio: `complete-integrated-browser-platform`.
Worktree: `.worktrees/upgrade-integrated-browser`, rama `codex/upgrade-integrated-browser`.
Resultado: cierra la implementación **6.4**. Progreso **54/64**, **10 pendientes**.
El cierre acredita código y pruebas automatizadas, no smoke del producto instalado.

## Implementación

- Supervisor CU con estados de arranque, ejecución, pausa pendiente, pausa y
  detención. Reserva desde apertura hasta drenaje/limpieza; señal raíz y señales
  por fase. Pausar interrumpe modelo/HITL, no finge cancelar entrada nativa.
- Reanudar toma captura nueva y reinicia la conversación del modelo conservando
  driver, guarda de destino, ID y presupuesto total. Los pasos intentados cuentan
  aunque se interrumpan; una pausa no repone presupuesto. El contexto pide revisar
  efectos previos, pero no garantiza detectar toda operación sensible: 6.5 sigue abierta.
- Detener/tomar control cancelan la tarea CU; una pausa se despierta sin continuar.
  Cerrar ventana, apagar o cambiar destino también cancelan. No deshacen efectos
  emitidos ni garantizan cancelar cómputo/cargos remotos o el turno padre del chat.
- Contrato main/handler/preload/wrapper con sesión, marco principal, ID CU,
  revisión de perfil y revisión de ejecución. Se rechaza reanudar otra pausa con
  un recibo viejo. Detener permite revisión de ejecución vieja de la misma tarea,
  porque sólo reduce autoridad. No se expone el supervisor a agentes runtime.
- Barra humana con Pausar, Reanudar, Detener y Tomar control. Los eventos de main
  son autoritativos; acuses/error tardíos no sobrescriben otro contexto. Puede
  escalar una pausa con acuse pendiente a detener y evita duplicar solicitudes.
- Estado del navegador incluye IDs de permisos vigentes para retirar los avisos
  cancelados sin guardar una decisión del sitio. La supervisión exige pestaña
  acoplada y mantiene controles fuera de pantalla completa HTML.

## Verificación

| Comando | Resultado |
|---|---|
| `npm run test -- integrated-browser BrowserAgentTaskControls BrowserAgentPolicyPrompt browser-cu-supervision desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload` | 902 pruebas en 59 archivos, aprobadas |
| `npm run typecheck` | Aprobado para main y renderer |
| `npm run lint:changed` | 238 archivos sin deuda nueva |
| `npx openspec validate complete-integrated-browser-platform --strict` | Aprobado |
| `git diff --check` | Salida 0 |
| `npm run verify:pr` | Bloqueado en la discrepancia previa de `skills:seed:check` |

Antes del bloqueo, el gate aprobó 27 adaptadores, harness (25 rutas, 9 skills),
cadena de suministro, documentación de sistema (28 documentos, 150 IDs, 421
canales y 451 archivos de prueba) y enlaces en 278 Markdown activos. El navegador
tiene 119 canales incluyendo eventos y 109 invocables. No se cambiaron la semilla
`database/lia/migrations/system-skills-catalog.sql` ni `src/shared/skills/registry.ts`.
La suite global posterior al bloqueo no se ejecutó; no se declara gate verde.

## Revisión adversarial

Se probaron respuesta del modelo tardía, entrada nativa pendiente, pausa al
arrancar, reanudación durante drenaje, cancelación externa/en pausa, cierre de
supervisor, destino inválido, presupuesto acumulado, ID/perfil ajenos, campos
extra, marco secundario y emisor sin sesión. Se verificaron retiro de listeners,
avisos obsoletos, exclusión de tareas y que tomar control no libera antes de drenar.

Se corrigieron dos riesgos durante revisión: ocultar controles con pantalla
completa/ventana separada y reutilizar un recibo antiguo para reanudar una pausa
posterior. El test main rechaza esa repetición y permite detener con el recibo
viejo sobre la misma tarea. Los tests usan dobles de Electron/modelo; no hay
llamadas a un proveedor ni prueba de renderizado nativo completo en este corte.

## Pendientes y reversión

Quedan 2.5 (zoom aislado real), 4.8 (autenticación/autobloqueo/formularios), 4.10
(passkeys), 5.6 (extensiones por sitio), 5.7 (catálogo/editor/actualizaciones),
6.5 (handoff sensible), 6.8 (índice semántico opt-in), 6.9 (Orbe), 8.7 (migraciones
y rollback restantes) y 9.5 (producto/instalador Windows y Lia con dos equipos).
No hubo despliegue, migración remota, modificación de secretos ni commits.

Este cambio no persiste datos nuevos. Para revertirlo, retirar conjuntamente
supervisor/enlace main, contrato IPC y controles de renderer, conservando la
cancelación CU anterior; no mezclar versiones de sus cuatro capas. No revertir
el worktree completo: contiene cambios previos ajenos a este corte.
