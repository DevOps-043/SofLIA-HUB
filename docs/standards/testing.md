# Estandar de pruebas

## Niveles

1. Focalizado: archivos y modulos modificados.
2. PR: typecheck, harness, lint de cambios y suite automatizada.
3. Release: PR mas build, empaquetado y smoke test.

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
