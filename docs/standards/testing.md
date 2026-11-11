# Estandar de pruebas

## Niveles

1. Focalizado: archivos y modulos modificados.
2. PR: typecheck, harness, lint de cambios y suite automatizada.
3. Release: PR mas build, empaquetado y smoke test.

verify:pr ejecuta la suite una sola vez con `test:coverage`. V8 incluye toda
producción TS/TSX de src/electron, también archivos no importados; sólo excluye
pruebas/fixtures y declaraciones. `config/coverage-policy.json` fija pisos
medidos: líneas 56%, sentencias 55%, funciones 51% y ramas 49%. Son límites de
no retroceso global, no objetivos finales de calidad. No bajar pisos ni excluir
producción para aprobar. El verificador compara el reporte con el inventario
Git completo, incluidos nuevos archivos no ignorados, y rechaza fuentes
omitidas/ajenas, totales inconsistentes y métricas ausentes o insuficientes.

La etapa runtime:stable de verify:pr comprueba el ejecutable Electron en modo
Node y los rangos de avisos registrados, además de manifest/lock/paquete. Una
excepción temporal de prerelease no puede anular un rechazo de seguridad.
Requiere las bibliotecas nativas del SO; un error de carga no se trata como skip.

verify:pr ejecuta también `python-tools:test`, con contratos stdlib del lector.
Requiere Python 3.12.x; usar SOFLIA_TEST_PYTHON absoluto para elegirlo por proceso.
Falta de intérprete no equivale a skip. Formatos con bibliotecas reales siguen
en `python-tools:test:formats` y matriz CI con locks exactos. Preparación y
límites: [desarrollo y CI](../operations/development-and-devops.md).

## Modulos nativos

La persistencia SQLite usa `node:sqlite`, incluido en el Node del ejecutor y en
Electron. Usar Node 24 para CI y publicación; no existe paso de rebuild para
better-sqlite3. Otros módulos nativos mantienen sus propios requisitos de ABI.
Un fallo del entorno no es evidencia de éxito: corregirlo y repetir.

## Evidencia

Los reportes de un cambio viven en
`openspec/changes/<cambio>/reports/`. Deben incluir comandos, resultado,
excepciones y restauracion de estado cuando hubo mutaciones.

## Regla de baseline

Mientras exista deuda historica de lint o pruebas, todo archivo modificado debe
quedar sin nuevas incidencias y el baseline total debe disminuir. No ampliar ni
ocultar el baseline para conseguir un gate verde. Los errores fatales de parser
se rechazan aunque también existan en HEAD: sin análisis no se demuestra
no regresión. `npm run test:quality` cubre esta distinción.

El lint incremental incluye TS/TSX/MTS/CTS y JS/JSX/MJS/CJS. Con
`HARNESS_BASE_REF` compara cambios comprometidos contra el ancestro común con
HEAD, además de los cambios locales contra HEAD. Cada base aplicable debe
cumplirse; una reducción previa no autoriza reintroducir incidencias locales.
Sin referencia explícita revisa cambios locales contra HEAD; en un checkout
limpio revisa el último commit contra su primer padre. El primer commit real
usa baseline vacío; historia shallow sin padre comparable y errores Git fallan.

Las cantidades históricas se comparan por regla y severidad, usando siempre
`eslint.config.mjs` de raíz, con sus exclusiones. Las rutas se leen literalmente,
sin seguir symlinks/junctions de fuentes; un renombre sin archivo en la base se
evalúa como fuente nueva. El índice participa en la selección, pero se analiza
el contenido actual del worktree: verificar el commit/CI antes de entregar un
índice distinto. La configuración y el propio gate siguen requiriendo revisión.
Las pruebas Node del tooling corren por archivo en serie para acotar procesos
ESLint simultáneos; los timeouts y las comprobaciones negativas siguen activos.
