# Evidencia de documentación y portabilidad del arnés

Estado: reporte de la revisión documental del 2026-10-15.

## Alcance

Se documentó la [arquitectura actual](../architecture/development-harness.md),
se creó la [guía de implementación en otro sistema](../operations/port-harness-to-another-system.md)
y se amplió el [registro de procedencia](../references/harness-sources.md).
Se enlazaron desde el índice documental, `ai-specs/README.md` y la guía rápida.
No cambia comportamiento, contratos ni permisos; no requiere una especificación
funcional nueva. No se modificó un repositorio receptor.

La inspección se realizó en el worktree existente, con cambios ajenos presentes,
sobre base `f0b18bca3948aa8157f8cc9e4a8d3fdaa2036da9`. La verificación global
incluye ese trabajo adicional y no constituye una línea base aislada de esta entrega.

## Evidencia de origen

Se contrastaron los scripts, configuración, políticas, registro, contratos
runtime y cambios OpenSpec con el historial Git local. La consulta pública
confirmó el repositorio LIDR y su README. No se recuperó desde la web el árbol
del commit externo registrado en julio y no se volvió a examinar el PDF original.
La documentación distingue esos límites de la evidencia comprobada en el árbol local.

## Comprobaciones realizadas

| Comando o revisión | Resultado observado |
| --- | --- |
| `npm run adapters:check` | Aprobado. |
| `npm run harness:validate` | Aprobado. |
| `npm run docs:system:check` | Aprobado. |
| `npm run docs:check` | Aprobado tras crear las guías y el reporte. |
| Evidencias declaradas en las dos guías nuevas | Todas las rutas existen. |
| `git diff --check` sobre archivos existentes modificados por esta entrega | Aprobado. |
| `npm run verify:pr` con `VITEST_MAX_WORKERS=2` | Código 1. Todas las etapas previas a Vitest aprobaron, incluidas especificaciones, tipos y lint incremental. Vitest: 432 archivos aprobados, uno fallido y dos omitidos; 4438 pruebas aprobadas, una fallida y cinco omitidas. Duración de Vitest: 396,64 segundos. |

El fallo fue un timeout de 15000 ms en
[background-teams.test.ts](../../electron/__tests__/background-teams.test.ts),
caso «crea Word, PowerPoint y Excel con fórmulas y los abre para comprobarlos».
Esta entrega no modificó código ni pruebas. No se reprodujo el fallo en un árbol
limpio ni se diagnosticó su causa; no se clasifica como deuda preexistente
demostrada. La compuerta global no está aprobada.

## Revisión y límites

Se comprobó la separación entre instrucciones y autorización ejecutable, el
carácter documental del registro YAML, los límites de sincronización de wrappers
y lint incremental, y las dependencias propias de SofLIA que deben sustituirse.
Esta revisión fue local; no se presenta como revisión independiente.

La adopción en el receptor, los casos negativos del piloto y su CI quedan como
pasos de implementación, no como pruebas ejecutadas. Revertir los archivos nuevos
y los enlaces añadidos por esta entrega revierte el cambio documental sin efectos
de datos. No se ejecutó empaquetado ni publicación.
