# Actores, roles y responsabilidades

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: src/lib/sofia-client.ts -->
<!-- evidence: electron/communication-hub/types.ts -->
<!-- evidence: ai-specs/agents/registry.yaml -->

## Actores de producto

| Actor | Identidad efectiva | Capacidades y limites implementados |
|---|---|---|
| Usuario autenticado | Usuario SOFIA resuelto a perfil Lia | Chat, carpetas, proyectos accesibles, ajustes personales, productividad, meetings y SDO cuando existe `userId` |
| Miembro de organizacion | `organization_users` con rol `owner`, `admin` o `member` | Datos segmentados por organizacion/equipos; selector de organizacion y miembro visible solo con organizacion activa |
| Owner | Rol de canal/organizacion `owner` | Configuracion organizacional, canales, politicas y destinatario de alertas cuando esta configurado |
| Admin | Rol `admin` | Administracion delegada segun politica del servicio; no equivale automaticamente a control total del host |
| Member | Rol `member` | Capacidades personales y de organizacion autorizadas; politicas organizacionales siguen aplicando |
| Contacto WhatsApp permitido | Numero normalizado y, si aplica, incluido en allowlist | Conversa con el agente y usa solo las herramientas autorizadas para DM/grupo |
| Participante de grupo WhatsApp | Sender + JID del grupo | Requiere politica de grupo y activacion; operaciones peligrosas permanecen bloqueadas |
| Usuario Telegram vinculado | `chatId` enlazado a `userId` y organizacion opcional | Capacidades del Communication Hub segun principal resuelto |
| Aprobador humano | Usuario identificado en flujo meeting/SDO/automation | Aprueba o rechaza artefactos y acciones; la identidad de la decision se persiste |
| Operador local | Persona con acceso al equipo y ajustes | Configura claves/conexiones, privacidad, voz, monitoreo, nodos y actualizaciones |

## Agentes runtime

| Agente | Proposito | Frontera de autoridad |
|---|---|---|
| Agente de WhatsApp | Conversacion y dispatch de herramientas | Politica por canal, grupo, capability, HITL y contrato de tool |
| Desktop Agent | Control de UI, navegador y escritorio | Un mouse/teclado compartido, cola, presupuesto de pasos, abort y verificacion |
| Agente de reuniones | Extraer y proponer minuta/acciones | No sincroniza resultados sin aprobacion requerida |
| Orbe/voz | Dictado local, TTS ElevenLabs y conversación flotante | Preload acotado; API key confinada a main; sidecar local para wake/dictado |
| Automatizacion Workspace | Ejecutar plantillas/workflows | Contratos de dominio y aprobaciones en operaciones criticas |
| Herramienta dinamica | Plugin descubierto por MCP Manager | Registro denegado sin schema, owner, riesgo, agentes, HITL, timeout y auditoria |

La lista canonica y la separacion de skills de desarrollo se define en
`ai-specs/agents/registry.yaml`; los agentes runtime declaran
`development_skills_exposed: []`.

## Roles de mantenimiento

| Rol del arnes | Responsabilidad | Fuente |
|---|---|---|
| `spec-analyst` | Enriquecer requisitos y actualizar documentacion | `ai-specs/agents/development/spec-analyst.md` |
| `electron-engineer` | Mantener main/preload/renderer e IPC | `ai-specs/agents/development/electron-engineer.md` |
| `data-security-engineer` | Migraciones, RLS, privacidad y adversarial | `ai-specs/agents/development/data-security-engineer.md` |
| `qa-verifier` | Seleccionar y ejecutar evidencia | `ai-specs/agents/development/qa-verifier.md` |
| `delivery-maintainer` | Aislamiento Git, docs, PR y entrega | `ai-specs/agents/development/delivery-maintainer.md` |

## Responsabilidad de datos

- SOFIA Learning es autoridad de identidad, organizaciones, membresias y equipos.
- Lia es autoridad operativa del Hub: chat, settings, monitoreo, meetings y SDO.
- IRIS es autoridad de proyectos/issues y objetos del sistema IRIS.
- SQLite local pertenece al perfil de aplicacion del host y no sustituye la
  autorizacion remota.

## Limite importante

Los nombres de rol describen el modelo de dominio, pero la autorizacion efectiva
de cada accion la decide el servicio/handler y las politicas de base de datos. La
UI oculta controles por conveniencia; ocultar un control no es una barrera de
seguridad.
