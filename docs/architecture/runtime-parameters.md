# Parametros runtime

Estado: vigente. Actualizado: 2026-08-04.

Inventario de defaults y topes con impacto operativo. Los overrides guardados en
`userData` pueden cambiar el valor efectivo de un host.

<!-- evidence: electron/desktop-agent/agent-config.ts -->
<!-- evidence: electron/memory/constants.ts -->
<!-- evidence: electron/monitoring/service-state.ts -->
<!-- evidence: electron/main/boot-timeline.ts -->
<!-- evidence: electron/main/window-controller.ts -->
<!-- evidence: electron/main/bootstrap.ts -->
<!-- evidence: electron/integrated-browser/types.ts -->
<!-- evidence: electron/integrated-browser/validation.ts -->

## Arranque

La ventana principal se crea antes de la cadena de servicios no esenciales y se
revela en `ready-to-show` para evitar el destello en blanco. El intro de audio
solo suena con la ventana visible (`visibilityState`), no en modo background.

| Parametro | Default/tope | Fuente |
|---|---:|---|
| fallback de `ready-to-show` | 4000 ms | `electron/main/window-controller.ts` |
| orden serial legacy (rollback) | `SOFLIA_STARTUP_LEGACY_ORDER=1` | `electron/main/bootstrap.ts` |
| hitos de arranque | `[BOOT] hito fase=... t_relativo_ms=... duracion_ms=...` | `electron/main/boot-timeline.ts` |

Presupuestos (tiempo hasta `ventana:visible` y hasta `servicios:init:fin`): se
fijan con la medicion antes/despues de la instrumentacion en los escenarios frio
tras reinicio, caliente y `--background`. Ver el cambio
`openspec/changes/optimize-startup-fluidity`. No se declara una cifra sin
evidencia medida en el host de referencia.

## Aplicacion e IPC

| Parametro | Default/tope | Fuente |
|---|---:|---|
| intro / gracia auth / salida overlay | 4200 / 700 / 1250 ms | `src/app/AppContent.tsx` |
| historial clipboard / polling | 100 / 5000 ms | `electron/main/service-factory.ts` |
| profundidad / array / claves IPC | 20 / 1000 / 200 | `electron/preload/safe-ipc.ts` |
| notas de release | 8000 caracteres | `src/components/update-notes/SafeReleaseNotes.tsx` |
| updater polling | 4 h | `electron/updater/constants.ts` |

## Navegador integrado

| Parametro | Default/tope | Fuente |
|---|---:|---|
| particion persistente | `persist:soflia-integrated-browser` | `electron/integrated-browser/types.ts` |
| espera de viewport para el agente | 8000 ms | mismo archivo |
| longitud de direccion/busqueda | 2048 caracteres | `electron/integrated-browser/validation.ts` |
| viewport minimo | 160 x 120 DIP | mismo archivo |
| protocolos de pagina principal | HTTP(S) y `about:blank` | mismo archivo |
| permisos con HITL | `media`, `geolocation` | `electron/integrated-browser/permission-governance.ts` |
| ancho del panel | minimo 420 DIP; chat minimo 320 DIP; snap al ancho total | `src/components/browser/BrowserWorkspaceLayout.tsx` |
| historial | 2.000 entradas; consulta maxima 200 | `electron/integrated-browser/browser-history-store.ts` |
| credenciales | usuario 320; secreto 4.096 caracteres; maximo almacenado 500 | `electron/integrated-browser/credential-vault.ts` |
| extension desempaquetada | Manifest V3; 2.000 archivos; 20 MiB | `electron/integrated-browser/extension-manager.ts` |

La vista integrada es unica por ventana principal. Perfiles explicitamente
aislados o con identificador siguen usando `BrowserWebService`/Playwright. Las
extensiones se recargan al iniciar porque Electron no las conserva cargadas; se
rechazan `nativeMessaging`, `debugger`, `proxy` y `management`.

## Red, archivos y correo

| Parametro | Default/tope | Fuente |
|---|---:|---|
| Supabase timeout / retries read / backoff | 25 s / 2 / 250 ms | `src/shared/supabase-http.ts` |
| RNF concurrencia (objetivo) / lectura p95 / error | 800 usuarios / < 400 ms / < 0.5 % | `docs/architecture/load-and-scalability.md` |
| archivo leido / search results / depth | 1 MiB / 200 / 8 | `electron/computer-use/filesystem-handlers/constants.ts` |
| comando / shell WhatsApp | 30 s / 15 s | `electron/computer-use/command-tool.ts`, `electron/whatsapp-terminal/shell-handler.ts` |
| destinatarios / asunto / cuerpo / adjuntos | 20 / 300 / 200000 / 10 | `electron/computer-use/email-security.ts` |
| Gmail batch / drain iterations | 100 / 500 | `electron/gmail/batch.ts` |
| media inline WhatsApp | 15 MiB | `electron/wa-agent/media-preparation.ts` |

## Memoria

| Parametro | Valor | Fuente |
|---|---:|---|
| chunk / overlap / chars por token | 400 / 80 / 4 | `electron/memory/constants.ts` |
| mensajes recientes / top K / score minimo | 30 / 10 / 0.22 | mismo archivo |
| budgets summary / semantic / facts / skills | 3000 / 2500 / 1800 / 1500 tokens | mismo archivo |
| skills / summaries en contexto | 8 / 5 | mismo archivo |
| umbral de resumen | 15 mensajes | mismo archivo |
| knowledge bootstrap por archivo / total | 15000 / 25000 caracteres | `electron/knowledge/constants.ts` |

## Monitoreo y proactive

| Parametro | Default | Fuente |
|---|---:|---|
| captura / idle | 30 / 120 s | `electron/monitoring/service-state.ts` |
| screenshot / OCR / semantic | on / off / off | mismo archivo |
| proactive enabled / intervalo | true / 5 min | `electron/proactive/config.ts` |
| horas de notificacion | 08:00 a 20:00 | mismo archivo |
| calendario / tareas / sistema | true / true / true | mismo archivo |
| briefing | disabled; `0 8 * * 1-5` | `electron/main/service-factory.ts` |
| campaign daily limit / preview | 250 / requerido | `electron/communication-hub/state.ts` |
| eventos audit local | 500 | mismo archivo |

## Desktop Agent

| Grupo | Valores default | Fuente |
|---|---|---|
| pasos | `maxSteps=60`, `defaultStepBudget=40`, `maxTotalSteps=500` | `electron/desktop-agent/agent-config.ts` |
| captura | 1024x768, active monitor, max edge 1568, min scale .5 | mismo archivo |
| timing | action 300 ms, change 8 s/500 ms, observation 2 s, queue 60 s | mismo archivo |
| recovery | 3 fallos, stuck 4, 2 retries, autorecover/replan on | mismo archivo |
| contexto | memory 10, resumen cada 15, raw 8, progress 25 | mismo archivo |
| elementos | max 60, dedup IoU .6, sufficient 12, skip visual 40, score .10, NMS .45 | mismo archivo |
| concurrencia | 1 agente visual | mismo archivo |
| engine | Gemini; modelo CU por registro; deteccion de prompt injection activa | mismo archivo |

## Reuniones, voz y agentes

| Parametro | Valor | Fuente |
|---|---:|---|
| WA loop / history | 25 iteraciones / 20 entradas | `electron/wa-agent/agent-loop.ts`, `constants.ts` |
| WA repeat / critical | 3 / 5 | `electron/wa-agent/constants.ts` |
| meeting screenshot default/min | 75 / 15 s | `electron/meeting-live/meeting-live-service.ts` |
| meeting chunk base64 / stop drain | 1000000 chars / 45 s | mismo archivo |
| source AI / low confidence | 16000 chars / .65 | `electron/meetings/meeting-ai/constants.ts` |
| Python model start / restart | 90 s / 3 | `electron/python-runtime-service.ts` |
| Python tools document/quick/restart | 60 s / 10 s / 3 | `electron/python-tools-service.ts` |
| speech orbe | 4000 caracteres | `src/components/orb/useOrbConversation.ts` |

## Politica de cambio

Cambiar un limite requiere: identificar actor y amenaza/costo, escenario positivo
y negativo, prueba de borde, observabilidad y rollback. Si altera comportamiento
visible, actualizar `LIM-*`, requisitos e historias relacionados.
