# Adopcion del Arnes

Estado: en ejecucion local. Actualizado: 2026-07-21.

<!-- evidence: openspec/changes/implement-soflia-harness/tasks.md -->
<!-- evidence: openspec/changes/enforce-runtime-tool-policies/tasks.md -->
<!-- evidence: openspec/changes/adapt-harness-and-document-system/tasks.md -->

El plan adapta los cinco pilares del PDF (instrucciones, herramientas, entorno,
estado y feedback) al repositorio real. Los cambios permanecen sin archivar hasta
integrarse en la rama objetivo; que una tarea local este marcada no equivale a
despliegue.

## Fase 1 - limpieza y fundacion: implementada localmente

- raiz y material historico ordenados;
- router `AGENTS.md`, standards, maps e indices;
- `ai-specs/` con roles, skills, politicas y plantillas;
- OpenSpec y compuertas adapters/harness/docs/types/lint/tests/build;
- SQL separado por Lia/IRIS/SOFIA y recursos runtime fuera de prompts dev.

Evidencia: cambio `implement-soflia-harness`, commit local `dcf3125`.

## Fase 2 - especificacion y piloto: implementada, pendiente de integracion

- flujo requisito -> Context Pack -> proposal/spec/design/tasks -> evidencia;
- Meeting Ops usado como dominio con contratos, approvals, idempotencia y sync;
- documentacion y pruebas conectadas al flujo.

El cambio fundacional aun no se archiva porque esta rama no se ha fusionado.

## Fase 3 - gobernanza runtime: implementada localmente

- herramientas dinamicas requieren contrato cerrado y metadata de seguridad;
- validacion Zod input/output, agent/group/HITL, timeout y auditoria;
- fingerprint evita usar aprobacion tras hot reload;
- Home Assistant migrado como toolset builtin;
- skills de desarrollo permanecen fuera del runtime.

Evidencia: `enforce-runtime-tool-policies`, commit local `506bab2`.

## Fase 4 - Antigravity y catalogo integral: en verificacion

- retirar Cursor y Gemini CLI del arnes;
- generar wrappers en `.agents/skills` y agregar rules/workflows oficiales;
- documentar producto, reglas, RF/RNF, historias, frontend, backend, datos,
  DevOps, UX/UI, paleta, limites, seguridad, pruebas y recuperacion;
- validar IDs, rutas de evidencia, links y cifras derivables.

Criterio de salida: `adapt-harness-and-document-system` completo, compuerta PR y
build app aprobados, revision adversarial y commit local.

## Fase 5 - endurecimiento posterior

Cada punto requiere un OpenSpec independiente:

1. Propagar identidad confiable a main y reemplazar RLS permisivo de meetings
   y `hub_service_state`.
2. Eliminar/renombrar referencias legacy AutoDev y datos aleatorios del digest.
3. Activar deteccion de prompt injection de Computer Use tras validacion.
4. Definir WCAG objetivo, axe/visual tests y reduced-motion global.
5. Definir RPO/RTO y backup local cifrado/verificado.
6. Alinear Node CI/release, cobertura por modulo y audit de dependencias/secrets.
7. Reducir bundle renderer y deuda de lint por dominio.

## Metricas de adopcion

- cambios materiales con OpenSpec y Context Pack;
- requisitos/reglas/historias afectados identificados en PR;
- fallos introducidos frente a preexistentes;
- bypass de permisos/HITL encontrados en adversarial;
- enlaces/evidencias rotos detectados por compuerta;
- retrabajo por contexto faltante y tiempo de revision.

No se fija una meta numerica sin linea base observada. La primera medicion debe
registrarse en reportes de cambios integrados, no inferirse de conversaciones.
