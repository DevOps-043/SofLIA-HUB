## Context

Ver propuesta/context-pack. La reproducción anterior aceptó un commit TS con
variable sin usar y omitió un mjs nuevo. El diagnóstico descubre 48 candidatos
JS/variantes adicionales en este worktree; faltan contextos Node y hay dos
expresiones ternarias de smokes propios que no cumplen la regla existente.

## Goals / Non-Goals

**Goals:** selección/comparación coherentes en local y CI, rutas literales y
fallos Git/parser observables, ocho extensiones y contextos de ejecución claros.

**Non-Goals:** analizar el índice como versión de entrega independiente, corregir
toda la deuda histórica, cambiar reglas funcionales, dependencias o publicar.

## Decisions

- Resolver HEAD y HARNESS_BASE_REF a commits. Para base explícita usar un único
merge-base; error, ausencia o ambigüedad fallan. No capturar fallos Git como si
fueran listas vacías. Sin base explícita se conserva modo local contra HEAD
cuando hay cambios; en checkout limpio se revisa el último commit contra su
primer padre. Primer commit real usa baseline vacío para fuentes comprometidas;
historia shallow sin base comparable falla.
- Unir rutas de diff comprometido, diff contra HEAD, índice y nuevos, mediante
NUL. Para cada ruta conservar revisiones aplicables; comparar el worktree actual
con cada una y deduplicar incidencias por identidad. Una mejora previa de HEAD
no concede presupuesto extra para regresiones locales.
- Separar selección/lectura Git en un módulo de tooling. Las fuentes baseline
se leen por blob sólo si existen como archivos regulares en ese árbol. Falta de
archivo es baseline vacío; fallo de Git al leer uno existente es error.
- Fijar explícitamente eslint.config.mjs de raíz: una configuración anidada
vacía también reprodujo un falso verde durante revisión. Filtrar exclusiones
con esa configuración y analizar texto con filepath literal; evita
que globs en nombres se conviertan en patrones. Verificar componentes de rutas
actuales para no seguir symlinks/junctions de fuentes. No leer .env o perfiles.
- Contextos explícitos: scripts Node ESM/CommonJS, fixtures Node y fuentes browser/TS.
Sólo callbacks DOM del smoke project-panel reciben document/window readonly;
no se conceden globals browser a todo main. Mantener reglas recomendadas, hooks y
unused-disable; no ampliar baseline ni añadir ignores de conveniencia.
- Repositorios Git propios temporales prueban commits, índice/worktree, dos
comparaciones, Unicode/globs, extensiones, parser, referencias y exclusiones.
Hooks/firma se desactivan sólo por comando de QA; no se hace commit del workspace.
- Ejecutar archivos de pruebas Node en serie para acotar instancias ESLint
simultáneas, conservando timeouts y aserciones. Completar las dos dependencias
locales faltantes del smoke IPC de Project Hub (management-request y su contrato
compartido); no se modifica esa funcionalidad, SQL ni el número de aserciones.

## Risks / Trade-offs

Más fuentes pueden revelar deuda previa → comparar HEAD bajo la misma config
y corregir sólo incrementos observados, conservando evidencia. Contexto mixto
de fixtures no debe extender permisos a código del producto → globs por área
y casos que rechazan globals ajenos. Configuración puede cambiar reglas → la
comparación usa la configuración vigente y su cambio requiere revisión; no es
una barrera contra un autor que cambie deliberadamente todo el gate.

Renombres sin archivo en la base se consideran fuente nueva, sin trasladar
deuda automáticamente. El comando certifica el worktree analizado; un índice
distinto debe verificarse tras commit/CI, no se declara compilado por este gate.

## Migration Plan

Regresiones rojas en repositorios temporales, implementación y contextos,
correcciones JS propias y suites afectadas. Documentar selección/límites,
autorrevisión, gate/build congelados y evidencia. Revertir selectivamente a
otra implementación que conserve estas garantías, no al falso verde anterior.
Revisión independiente pendiente antes de archivar.
