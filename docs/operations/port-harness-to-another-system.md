# Implementar el arnés en otro sistema

Estado: vigente. Actualizado: 2026-10-15.

<!-- evidence: docs/architecture/development-harness.md -->
<!-- evidence: scripts/ai/sync-agent-adapters.mjs -->
<!-- evidence: scripts/quality/validate-harness.mjs -->
<!-- evidence: scripts/quality/run-gate.mjs -->
<!-- evidence: package-lock.json -->
<!-- evidence: openspec/config.yaml -->

## Resultado y alcance

Esta guía traslada el arnés de **desarrollo asistido por agentes** de SofLIA a
otro repositorio: contexto canónico, skills, estado OpenSpec, aislamiento y
verificación. Su [arquitectura](../architecture/development-harness.md) explica
las dependencias; el [registro de fuentes](../references/harness-sources.md)
identifica el repositorio externo original.

Es una receta de adaptación. En esta entrega no se ha modificado ni verificado
un sistema de destino. La implementación mínima no necesita Electron, Gemini,
Codex app-server, base de datos ni un orquestador multiagente dentro del producto.
Puede usarse con el stack y la herramienta de desarrollo del sistema receptor.

Si lo que se busca es que **los usuarios del producto** ejecuten equipos de IA,
consultar también la sección runtime al final: es una implementación distinta.

## 1. Inventariar el repositorio receptor

Antes de escribir archivos, registrar:

- Stack, versiones reales, gestor de paquetes y comandos que ya funcionan.
- Rutas de frontend/backend/datos, contratos públicos y responsables.
- Herramientas de desarrollo usadas y reglas existentes que deben conservarse.
- Acciones que requieren aprobación humana y autoridad que ejecuta cada efecto.
- Pruebas, lint, tipos y CI actuales; fallos preexistentes reproducibles.
- Rama base, estado Git y trabajo ajeno que deba preservarse.

Trabajar en una rama o worktree aislado cuando haya implementación material.
La línea base permite separar los fallos de la adaptación de la deuda anterior.
Conservar las licencias y avisos aplicables a los archivos reutilizados.

## 2. Crear el núcleo canónico

La siguiente estructura es un objetivo para el receptor; cada documento se
redacta con sus contratos y stack reales:

```text
AGENTS.md
docs/
  README.md
  standards/
    base.md
    engineering-practices.md
    documentation.md
  architecture/
  operations/
ai-specs/
  README.md
  policies/
  agents/
    registry.yaml
    development/
  skills/
  templates/
openspec/
  config.yaml
  specs/
  changes/
scripts/
  ai/
  quality/
```

`AGENTS.md` debe indicar el orden de lectura y apuntar a estándares, dominio,
cambio activo y skill correspondiente. Las reglas extensas se mantienen en una
fuente canónica; los adaptadores remiten a ella. Incluir separación de capas,
idioma, permisos, protección de secretos, preservación de cambios ajenos y
criterios de terminado que se puedan verificar en el receptor.

Si el receptor ya tiene documentación canónica en otras rutas, conservarla y
ajustar referencias. No imponer el árbol de SofLIA duplicando contenido existente.

Las dependencias del núcleo son Git, Node para los scripts `.mjs` y OpenSpec.
El sincronizador y los validadores de estructura/enlaces usan módulos nativos de
Node; el lint incremental añade ESLint y su configuración. Los lenguajes,
compiladores y ejecutores de pruebas del producto se mantienen según el receptor.
No copiar `package.json` ni el lockfile completo de SofLIA: se usan como referencia
para trasladar únicamente scripts y dependencias necesarios.

## 3. Seleccionar qué reutilizar

Todas las rutas enlazadas en esta tabla pertenecen al repositorio SofLIA de origen.

| Fuente | Acción en el receptor |
| --- | --- |
| [Plantillas de contexto y evidencia](../../ai-specs/templates) | Reutilizar su formato y completar datos reales en cada cambio. |
| [enrich-requirement](../../ai-specs/skills/enrich-requirement/SKILL.md), [verify-change](../../ai-specs/skills/verify-change/SKILL.md), [adversarial-review](../../ai-specs/skills/adversarial-review/SKILL.md), [update-project-docs](../../ai-specs/skills/update-project-docs/SKILL.md), [prepare-pull-request](../../ai-specs/skills/prepare-pull-request/SKILL.md), [using-git-worktrees](../../ai-specs/skills/using-git-worktrees/SKILL.md) | Adaptar comandos, rutas, roles, permisos y criterios de verificación. Conservar sus recursos auxiliares necesarios. |
| [Skills del dominio](../../ai-specs/skills) | Incorporar IPC, migraciones, presentaciones o audiovisual únicamente si esos dominios existen en el receptor. |
| [Router](../../AGENTS.md), [estándares](../standards), [registro](../../ai-specs/agents/registry.yaml), [políticas](../../ai-specs/policies) | Reescribir referencias, identidades y fronteras con la arquitectura receptora. |
| [Sincronizador](../../scripts/ai/sync-agent-adapters.mjs) | Reutilizable si se conserva el esquema de skills; editar `targets` para las herramientas elegidas. |
| [Validador del arnés](../../scripts/quality/validate-harness.mjs) | Adaptar rutas obligatorias, secciones, metadatos, registro y vetos; no ejecutar sin revisar sus supuestos. |
| [Validador de enlaces](../../scripts/quality/check-doc-links.mjs) | Adaptar las raíces que recorre y los routers admitidos. No comprueba anclas Markdown ni disponibilidad web. |
| [Lint incremental](../../scripts/quality/lint-changed.mjs) | Usar solo si corresponde TypeScript/ESLint; para otro stack crear el equivalente. Revisar sus límites de comparación. |
| [Validador documental](../../scripts/quality/validate-system-docs.mjs) | Reescribir catálogo, IDs e inventarios. Quitar o reemplazar comprobaciones de IPC/paleta propias de SofLIA. |
| [Compuerta](../../scripts/quality/run-gate.mjs) y [CI](../../.github/workflows/ci.yml) | Mantener la secuencia con parada ante fallo, sustituyendo los pasos por verificaciones del receptor. |
| [Configuración OpenSpec](../../openspec/config.yaml) | Sustituir el contexto de producto y reglas del dominio. |

No trasladar el historial de `openspec/changes/`, los requisitos del negocio,
archivos locales, credenciales ni catálogos de datos de SofLIA. Las pruebas y
servicios del producto se conservan en el sistema al que pertenecen.

## 4. Conectar las herramientas de desarrollo

Para cada herramienta elegida, mantener un router delgado y el mecanismo de
descubrimiento que corresponda. En SofLIA las referencias son
[CLAUDE.md](../../CLAUDE.md), [codex.md](../../codex.md) y la
[regla Antigravity](../../.agents/rules/soflia-harness.md).

Si se reutiliza el sincronizador:

1. Guardar cada skill bajo `ai-specs/skills/<nombre>/SKILL.md` con frontmatter
   `name` y `description`; el nombre coincide con el directorio.
2. Seleccionar los destinos que realmente use el equipo.
3. Adaptar o conservar la exigencia de `agents/openai.yaml` del validador según
   los metadatos que mantenga el receptor; el sincronizador no genera ese archivo.
4. Ejecutar sincronización y luego comprobación. No editar wrappers generados.
5. Revisar manualmente wrappers retirados y recursos auxiliares al renombrar skills.

Las carpetas `.cursor/`, `.gemini/` y `GEMINI.md` están vetadas por una decisión
del equipo SofLIA. Ese veto no es una propiedad universal del patrón: si el
receptor usa esas herramientas, actualizar destinos y validadores de forma coherente.

## 5. Inicializar OpenSpec y el estado durable

Para un receptor que use npm, una referencia reproducible es la versión **1.8.0**
resuelta en el [lockfile de SofLIA](../../package-lock.json) al realizar esta
revisión. `package.json` declara un rango distinto de la versión resuelta; no
confundir ambas cosas ni asumir que esta versión es la más reciente.

En el repositorio receptor, estos comandos instalan esa referencia e inician
la configuración; requieren Node/npm disponibles:

```powershell
npm install --save-dev --save-exact @fission-ai/openspec@1.8.0
npx.cmd --no-install openspec init
```

Elegir en el inicializador las herramientas del receptor. En otros shells usar
`npx` en lugar de `npx.cmd`. Si OpenSpec ya está configurado, revisar y adaptar
su configuración existente en lugar de reinicializarla sin inspección.

En `openspec/config.yaml`, registrar el stack real, las fuentes canónicas y
reglas por artefacto. Crear un primer cambio pequeño con propuesta, diseño,
escenarios y tareas; incorporar contexto y evidencia cuando correspondan.
Las [plantillas de SofLIA](../../ai-specs/templates) ayudan a conservar la misma
disciplina sin copiar el contenido de un cambio anterior.

## 6. Conectar comprobaciones y CI

Para un receptor con npm, registrar estos nombres en `package.json` **después**
de crear o adaptar los archivos correspondientes:

| Script | Implementación de referencia |
| --- | --- |
| `adapters:sync` | `node scripts/ai/sync-agent-adapters.mjs` |
| `adapters:check` | `node scripts/ai/sync-agent-adapters.mjs --check` |
| `harness:validate` | `node scripts/quality/validate-harness.mjs` |
| `docs:check` | `node scripts/quality/check-doc-links.mjs` |
| `openspec:validate` | `openspec validate --all --strict --no-interactive` |
| `verify:pr` | `node scripts/quality/run-gate.mjs`, adaptado al receptor |

Conectar además los comandos reales de tipos, lint y pruebas del receptor.
Los scripts Node del núcleo pueden convivir con un producto Python, Java u otro
stack: la compuerta invoca sus verificadores nativos. No crear comandos vacíos
que devuelvan éxito para simular una comprobación.

El orden de arranque recomendado es adaptadores → estructura → enlaces →
OpenSpec → tipos/lint aplicables → pruebas. Añadir validación de documentación
y cadena de suministro cuando sus reglas estén adaptadas. Eliminar del runner
las verificaciones específicas de Skills de SofLIA y el empaquetado Electron
cuando no existan en el receptor.

El CI debe instalar dependencias desde el lockfile, ejecutar la misma compuerta
que el entorno local y conservar suficiente historial si usa lint incremental.
Si se reutiliza ese lint, fijar `HARNESS_BASE_REF` a la base del PR y verificar
que el resultado sea el esperado. Configurar por separado las comprobaciones
obligatorias de la rama en el proveedor Git cuando esa sea la política del equipo.

## 7. Validar la adopción con un cambio piloto

Primero ejecutar las comprobaciones estructurales adaptadas:

```powershell
npm run adapters:sync
npm run adapters:check
npm run harness:validate
npm run docs:check
npm run openspec:validate
npm run verify:pr
```

Después, en una rama temporal, comprobar comportamientos observables:

| Caso | Resultado esperado en el receptor |
| --- | --- |
| Cambio piloto completo | Otro agente puede leer router, propuesta, tareas y evidencia y continuar el trabajo. |
| Skill canónica modificada sin regenerar | Falla `adapters:check`; tras sincronizar vuelve a pasar. |
| Ruta obligatoria ausente o fuente de rol inexistente | Falla el validador con la ruta concreta. |
| Enlace local a un archivo inexistente | Falla `docs:check`. |
| Especificación inválida | Falla la validación OpenSpec. |
| Error nuevo detectado por lint o pruebas | Falla `verify:pr` y también CI. |
| Tarea no ejecutada o prueba omitida | El reporte registra la brecha y no declara éxito completo. |
| Encargo fuera de permisos | El host exige o deniega autorización según su política; el Markdown no la concede. |

Revertir únicamente las alteraciones intencionales del piloto y conservar
comandos, códigos de salida y hallazgos en su reporte. Terminar con diff revisado,
documentación actualizada y compuerta exitosa o limitaciones explícitas.
Archivar el cambio después de integrarlo y sincronizar sus especificaciones.

## Encargo reutilizable para el agente del receptor

Se puede adjuntar esta guía y la arquitectura en el otro repositorio y usar:

```text
Adapta a este repositorio el arnés de desarrollo descrito en las guías adjuntas.
Primero inspecciona nuestras reglas, stack, contratos, comandos, CI y estado Git.
Registra la línea base y conserva trabajo ajeno. Mantén una sola fuente canónica
de instrucciones, skills reutilizables y adaptadores para las herramientas que
usamos. Configura OpenSpec con nuestro dominio y conecta validadores y CI reales.
Reemplaza los supuestos de SofLIA; no importes su historial, secretos ni permisos
runtime. Documenta alcance, decisiones y criterios antes de cambiar comportamiento.
Implementa por tareas pequeñas, realiza un cambio piloto, comprueba fallos
intencionales en una rama temporal y registra evidencia real. Entrega un diff
revisable con riesgos y pasos de reversión; no publiques ni despliegues.
```

## Si se necesita el arnés runtime dentro del otro producto

La fuente canónica es el [contrato runtime](../architecture/runtime-multiagent-harness.md).
Elegir la ruta según el comportamiento necesario:

| Necesidad | Referencias de SofLIA | Adaptaciones necesarias |
| --- | --- | --- |
| Especialistas que aportan análisis y un coordinador que termina | [policy](../../src/shared/agent-teams/policy.ts), [runner](../../src/shared/agent-teams/runner.ts), [pruebas](../../src/__tests__/services/agent-teams.test.ts) | Roles, selección por solicitud, función `generate`, presupuesto, eventos, cancelación y herramientas del coordinador. |
| Flujo supervisado con estado y aprobación de resultado | [agent-runtime](../../electron/agent-runtime), [contrato](../../src/shared/agent-runtime.ts), [pruebas](../../electron/__tests__/agent-runtime.test.ts) | Dominio en lugar de reuniones, identidad/organización, catálogo de lectura, repositorio y publicación aprobada. |
| Trabajos que crean archivos y pueden recuperarse | [background-teams](../../electron/background-teams), [contrato](../../src/shared/background-teams.ts), [pruebas](../../electron/__tests__/background-teams.test.ts) | Host de ejecución, herramientas acotadas, almacenamiento, cifrado, artefactos, hashes, estados y recuperación. |

La ruta de equipos breves es la menos acoplada: usa una función de generación
inyectada y no importa Electron. Aun así, contiene prompts, roles y clasificación
propios de SofLIA. Tiene concurrencia por proceso, no un límite distribuido entre
réplicas. Su coordinador y la creación real de archivos viven fuera del runner.

En un servidor web, sustituir main/IPC por servicios y endpoints autenticados;
mantener validación y autorización del lado servidor. Si hay varios procesos,
introducir el control de concurrencia y persistencia compartidos que el receptor
requiera. Una tarea de análisis efímera no proporciona por sí sola trabajo durable.

La secuencia mínima de adaptación runtime es: fijar identidad y alcance en el host;
definir contratos y límites; conectar proveedor; admitir trabajo; ejecutar etapas;
aplicar guardas antes de cada herramienta; conservar estados reales; verificar
resultado; solicitar aprobación ligada al efecto cuando corresponda. Probar
cambios de sesión, herramientas denegadas, cancelación, fallos parciales y reinicio.
No convertir `ai-specs/skills/` en permisos ejecutables ni reutilizar credenciales
personales de herramientas de desarrollo.

El adaptador Codex es opcional y está acoplado al flujo de reuniones. Su
[investigación histórica](../reports/codex-repository-research-2026-09-21.md) y las
pruebas de protocolo sirven para estudiar esa alternativa; el arnés de desarrollo
y los equipos breves no dependen de ese adaptador.
