# Agentes y automatizacion

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: ai-specs/agents/registry.yaml -->
<!-- evidence: electron/wa-agent/agent-loop.ts -->
<!-- evidence: electron/desktop-agent/agent-config.ts -->

Este documento es el resumen normativo. El detalle exhaustivo de cada agente
runtime, su catalogo de herramientas, sus guardas y sus limites vive en
[Manual del agente runtime](runtime-agents-manual.md).

## Dos planos separados

| Plano | Ubicacion | Puede modificar repo | Puede ejecutar acciones del usuario |
|---|---|---:|---:|
| Desarrollo | `ai-specs/`, `.codex/`, `.claude/`, `.agents/`, OpenSpec | si, dentro del flujo Git | no por estar definido como skill |
| Runtime | `electron/wa-agent/`, `desktop-agent/`, meetings, automation | no debe tocar Git por defecto | solo mediante tools/handlers/politicas |

Una instruccion Markdown no concede permisos. El registro de desarrollo declara
`development_skills_exposed: []` para cada agente runtime; el loader dinamico solo
busca directorios runtime configurados.

## Loops de producto

### Chat renderer

`src/services/gemini-chat/` construye historial/instruccion, llama Gemini, procesa
stream y function calls, despacha tools de Workspace/computer/project y aplica
timeout/retry/circuit breaker. El renderer solicita acciones nativas a main; no
las ejecuta directamente.

### WhatsApp Agent

`electron/wa-agent/agent-loop.ts` ejecuta hasta 25 iteraciones. El contexto incluye
remitente, grupo, owner de memoria, herramientas declarables y evidencia. El loop
guard detecta llamadas repetidas (warning 3, critico 5); polls conocidos no cuentan
igual. Declaraciones de grupo se filtran antes de llegar al modelo y el executor
vuelve a validar.

### Desktop Agent

La ruta selecciona backend determinista, browser, desktop visual o UIA. El agente:

1. prepara contexto de apps/ventanas y plan jerarquico;
2. captura monitor/ventana y fusiona elementos UIA, OCR y visual;
3. propone una accion tipada;
4. ejecuta mediante input backend;
5. verifica cambio visual y detecta stuck/fallos;
6. resume historial y replanifica hasta completar, abortar o agotar presupuesto.

La concurrencia visual es 1. Browser/nodos pueden tener estado separado, pero
`executeParallel` no autoriza dos tareas a compartir mouse/teclado sin cola.

### Reuniones

Los servicios de IA extraen propuestas y artefactos; review y sync son servicios
separados. Aprobacion humana es un estado de negocio persistido, no una frase
interpretada por el modelo.

### Workspace Automation y Workflow Hub

Automation administra templates/runs y sus aprobaciones. Workflow Hub compone
Calendar, Google Chat, scheduler, automation y meetings en casos y variantes. Las
skills aprendidas ejecutables de memoria solo llaman templates registrados por
este servicio.

## Herramientas estaticas y dinamicas

| Tipo | Registro | Validacion | Seguridad |
|---|---|---|---|
| Estatica WhatsApp | declaraciones/dispatcher versionados | schema del proveedor + handlers | capability, grupo, confirmacion y tool-specific guards |
| Computer use | mapping IPC/tool dispatch | argumentos por handler | command policy, paths, confirmacion, timeout |
| Dinamica | `MCPManager` + archivos toolset | Zod compila JSON Schema cerrado input/output | owner, risk, allowedAgents, HITL, groups, timeout, audit, fingerprint |

Home Assistant es el toolset dinamico builtin migrado. Plugins legacy sin contrato
completo no se cargan. El timeout es cooperativo: I/O que respeta `AbortSignal`
termina; codigo sincrono que bloquea el event loop sigue siendo riesgo residual.

## Arnes de desarrollo adaptado

- `AGENTS.md`: router pequeno y normas no negociables.
- `ai-specs/agents`: roles; `skills`: procedimientos; `policies`: fronteras.
- `.agents/skills`: wrappers Antigravity generados.
- `.agents/rules`: regla de workspace.
- `.agents/workflows`: propuesta, aplicacion, verificacion y archivo.
- `openspec/changes`: estado durable del cambio.
- `scripts/quality/run-gate.mjs`: feedback ejecutable.

Cursor y Gemini CLI no estan soportados. Gemini en nombres como
`gemini-chat`/`WA_MODEL` es proveedor runtime, no herramienta de desarrollo.

## Capacidades ausentes o legacy

AutoDev no esta en el bootstrap actual y no existe servicio fuente activo; textos
y tests que lo mencionan son deuda legacy. Tampoco hay un orquestador de agentes
de desarrollo dentro del ejecutable. Antigravity/Codex/Claude operan fuera del
producto sobre Git y OpenSpec.
