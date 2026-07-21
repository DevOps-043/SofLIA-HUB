# Guia rapida para usar el arnes

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: AGENTS.md -->
<!-- evidence: docs/standards/engineering-practices.md -->
<!-- evidence: .agents/rules/soflia-harness.md -->
<!-- evidence: .agents/workflows/openspec-propose.md -->
<!-- evidence: package.json -->

Esta guia permite iniciar trabajo real en Antigravity sin copiar prompts largos
ni reconstruir contexto en cada conversacion.

## Que carga el sistema

Al abrir la raiz del repositorio en Antigravity, el workspace ofrece:

- `.agents/rules/soflia-harness.md`: regla permanente del proyecto;
- `.agents/skills/`: procedimientos especializados sincronizados desde
  `ai-specs/skills/`;
- `.agents/workflows/`: comandos repetibles para proponer, aplicar, verificar y
  archivar cambios OpenSpec;
- `AGENTS.md`: router que decide que documentacion cargar;
- `openspec/changes/`: memoria durable de alcance, decisiones, tareas y evidencia.

No es necesario pegar el antiguo prompt completo en cada tarea. `AGENTS.md` y la
regla del workspace cargan el estandar maestro. La referencia
`@docs/prompt_maestro.md` sirve para reforzarlo explicitamente o conservar un
flujo existente.

## Primera comprobacion

Desde PowerShell, en la raiz del repositorio:

```powershell
npm run adapters:check
npm run harness:validate
npm run docs:check
npm run openspec:validate
```

Los cuatro comandos deben terminar con codigo cero. `adapters:sync` no es un
comando cotidiano: se usa cuando cambia una skill canonica para regenerar sus
wrappers Codex, Claude y Antigravity.

## Primer mensaje recomendado

Para una tarea material:

```text
@AGENTS.md @docs/prompt_maestro.md

Necesito <resultado observable>. Revisa primero el codigo y la documentacion
vigente. Usa el cambio OpenSpec existente si corresponde; si no existe, crea una
propuesta. No implementes capacidades inventadas y registra pruebas y riesgos.
```

El `@prompt_maestro` es opcional porque ya forma parte de la lectura obligatoria,
pero es util al iniciar una conversacion nueva o auditar una respuesta.

## Ciclo normal de una funcionalidad

### 1. Proponer

En Antigravity ejecuta el workflow:

```text
/openspec-propose <descripcion concreta del cambio>
```

Debe producir bajo `openspec/changes/<nombre>/`:

- `context-pack.md` cuando el requerimiento necesite enriquecimiento;
- `proposal.md` con alcance y no objetivos;
- `design.md` con decisiones, riesgos y rollback;
- `specs/*/spec.md` con requisitos y escenarios;
- `tasks.md` con unidades verificables.

No se implementa mientras una decision faltante pueda cambiar datos, permisos,
contratos o UX de forma material.

### 2. Aplicar

Despues de revisar la propuesta:

```text
/openspec-apply <nombre-del-cambio>
```

El agente lee los artefactos, trabaja una tarea a la vez, mantiene las casillas
al dia y actualiza codigo, pruebas y documentacion juntos. Las skills del area se
activan por la naturaleza del cambio; por ejemplo, `electron-ipc-change` para una
capacidad que cruza main, preload y renderer.

### 3. Verificar

```text
/openspec-verify <nombre-del-cambio>
```

La verificacion va de pruebas focalizadas a la compuerta de PR:

```powershell
npm run typecheck
npm run lint:changed
npm run harness:validate
npm run docs:check
npm run verify:pr
```

El reporte bajo `openspec/changes/<nombre>/reports/` guarda comandos, resultados,
casos negativos, riesgos residuales y efectos externos. No uses
`verify:release` salvo que realmente se prepare un candidato de distribucion.

### 4. Revisar y guardar

Antes del commit, la revision adversarial intenta refutar el cambio: permisos,
HITL, secretos, IPC, RLS, estados parciales, datos inventados, archivos huerfanos
y rollback. El commit local solo se crea cuando las tareas y evidencia coinciden
con el diff.

### 5. Archivar

```text
/openspec-archive <nombre-del-cambio>
```

Se ejecuta despues de integrar el cambio en la rama objetivo. Un commit en una
rama local no basta: archivar antes eliminaria de la vista activa una entrega que
aun no esta integrada.

## Que flujo usar segun el trabajo

| Trabajo | Flujo minimo |
| --- | --- |
| Pregunta o diagnostico sin cambios | Leer router y dominio; inspeccion de solo lectura. |
| Correccion local sin cambio de contrato | Diagnostico, cambio pequeno, prueba focalizada, documentacion si aplica. |
| Funcionalidad o comportamiento observable | OpenSpec completo: proponer, aplicar, verificar y archivar tras integrar. |
| IPC nuevo o modificado | OpenSpec + skill `electron-ipc-change` + prueba de las cuatro capas. |
| Tabla, indice, funcion o RLS | OpenSpec + skill `supabase-migration` + rollback; no ejecutar SQL sin permiso. |
| Refactor amplio o trabajo paralelo | Rama/worktree recuperable + tareas atomicas + compatibilidad comprobada. |
| Release | `verify:release` y publicacion solo con autorizacion explicita. |

## Donde vive cada tipo de contexto

| Contexto | Fuente |
| --- | --- |
| Reglas permanentes | `AGENTS.md` y `docs/standards/` |
| Procedimientos reutilizables | `ai-specs/skills/` |
| Adaptador Antigravity | `.agents/` |
| Alcance y decisiones de una entrega | `openspec/changes/<nombre>/` |
| Arquitectura y contratos actuales | `docs/architecture/`, `docs/data/`, `docs/product/` |
| Evidencia de verificacion | `openspec/changes/<nombre>/reports/` |
| Material reemplazado | `docs/archive/`, nunca como norma vigente |

## Reglas practicas

- Usa Antigravity para desarrollo; no regeneres `.cursor/`, `.gemini/` ni
  `GEMINI.md`.
- No expongas las skills de desarrollo a los agentes runtime del producto.
- No pidas al agente que lea `.env`; proporciona solo el nombre de una variable
  cuando sea necesario documentarla.
- No permitas que una tarea se declare completa solo porque compila.
- Revisa `git diff` y el reporte de evidencia antes de aceptar un commit.
- Conserva los cambios OpenSpec activos hasta que la entrega este integrada.

## Problemas frecuentes

### Antigravity no muestra una skill

Ejecuta:

```powershell
npm run adapters:sync
npm run adapters:check
```

Despues vuelve a abrir el workspace. No edites directamente el wrapper bajo
`.agents/skills/`; modifica `ai-specs/skills/<nombre>/SKILL.md`.

### Un workflow no aparece

Confirma que el archivo existe bajo `.agents/workflows/`, que es Markdown y que
no supera 12000 caracteres. `npm run harness:validate` comprueba esas condiciones.

### OpenSpec no se resuelve como comando en PowerShell

Usa los scripts npm del proyecto. Para una operacion directa en Windows se puede
invocar `npx.cmd openspec ...`; no depende de una instalacion global.

### El agente ignora buenas practicas

Referencia `@AGENTS.md @docs/prompt_maestro.md`, pide que enumere los criterios
aplicables antes de editar y termina con `/openspec-verify`. Si la regla sigue
sin cargarse, ejecuta `npm run harness:validate` y vuelve a abrir el workspace.
