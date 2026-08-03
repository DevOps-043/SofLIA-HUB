# Contexto del cambio

- Objetivo: adaptar el arnes AI-spec a Codex, Claude y Antigravity y crear la
  documentacion especifica y trazable del sistema Pulse Hub implementado.
- Usuario o actor: equipo de producto, desarrollo, QA, seguridad, operaciones y
  agentes de desarrollo que mantienen Pulse Hub.
- Alcance: adaptadores del arnes, reglas/workflows Antigravity, catalogo de
  producto, requisitos, reglas, historias, arquitectura, datos, UX/UI, seguridad,
  DevOps, operacion, limites y decisiones.
- No objetivos: sustituir el proveedor de IA usado por el producto, ejecutar
  migraciones remotas, desplegar, publicar la rama o redisenar la interfaz.
- Restricciones: `ai-specs/` es canonico; los adaptadores son delgados; no se
  inventan motivos ni contratos; toda afirmacion implementada enlaza evidencia
  versionada; las inferencias se marcan como tales.
- Contratos afectados: scripts de sincronizacion/validacion del arnes, rutas de
  adaptadores y catalogo documental. No cambia IPC, API, tablas ni runtime.
- Riesgo y HITL: retirar adaptadores obsoletos es recuperable con Git. No hay
  efectos externos ni acciones que requieran aprobacion adicional.
- Criterios verificables: `.cursor/`, `.gemini/` y `GEMINI.md` no estan
  versionados; `.agents/` contiene skills, regla y workflows; validadores detectan
  drift; OpenSpec y enlaces son validos; el catalogo cubre todas las areas
  obligatorias y sus rutas de evidencia existen.
- Incertidumbres: varias razones historicas no estan registradas; se documenta la
  justificacion observable o inferida sin presentarla como decision confirmada.
