## Context

Ver proposal.md y el diagnóstico. La rama codex/reduce-technical-debt conserva los dos informes no versionados; el producto no tiene cambios ajenos pendientes.

## Goals / Non-Goals

Se corrigen contratos existentes y compuertas, sin sustituir la arquitectura ni introducir un framework de permisos. Los restantes dominios se secuencian en docs/plans/technical-debt-reduction.md.

## Decisions

- Mantener servicio, handlers, allowlist, preload y wrapper. Compartir sólo tipos/DTO de calendario; Zod valida entradas en main. Fechas ISO en IPC y Date dentro del servicio. El wrapper desenvuelve eventos y comunica errores; el chat usa el mismo wrapper.
- Autorizar únicamente el marco principal de la ventana main u orbe registradas. Revalidar sesión, identidad, conexión y marco tras diálogo. Una confirmación activa por registro, caducidad 120 s; cambios A-B-A invalidan por revisión. Sin bypass por variable de entorno.
- Proyectar eventos explícitos, nunca reenvío de objetos de conexión/token o error remoto. Usar logger estructurado sin payloads sensibles.
- ESLint conserva reglas: fijar raíz y excluir worktrees, fallar ante mensajes fatales tanto en source como baseline. No ampliar baseline ni silenciar reglas.
- Gate de release como job del mismo SHA previo a builds; Node 24 en todos; Linux usa build:linux. No workflow reusable nuevo ni duplicación de comandos de compilación.

## Risks / Trade-offs

- Confirmar añade un diálogo a cada mutación IPC: necesario por efectos externos. Los agentes de canales conservan sus propias guardas.
- El diálogo nativo no se puede cancelar físicamente al vencer: el resultado tardío se rechaza y no produce efecto. No se permite otro mientras permanezca pendiente.
- Una petición remota ya enviada no se puede deshacer con logout. No se promete rollback remoto ni idempotencia nueva.
- Los tests con dobles no acreditan UI/credenciales reales; build y despliegue sólo se revisan localmente.

## Migration Plan

Cambios locales sin migración de datos ni nuevos canales. Revertir el commit de este bloque revierte código/tooling; no revierte efectos externos del calendario. No archivar hasta revisión independiente y cierre del programa correspondiente.

## Ajuste confirmado durante verificación

La suite completa reprodujo timeouts históricos en los casos XLSX de visor y
equipos: 26,3 y 20,8 segundos bajo paralelismo ilimitado. Se limita el pool a
min(4, núcleos disponibles) y se carga ExcelJS en la recolección de esas dos
suites; los casos mantienen sus aserciones reales y timeout de 15 segundos.
La carga fría se distingue de la operación de archivo, no se oculta un fallo
de contenido. La ejecución completa posterior aprobó: 4476 pruebas pasaron,
5 permanecieron omitidas y no hubo fallos. Esto verifica la ejecución local de
esta unidad; no garantiza ausencia de flakiness en toda plataforma.
