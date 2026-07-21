# Estandar de pruebas

## Niveles

1. Focalizado: archivos y modulos modificados.
2. PR: typecheck, harness, lint de cambios y suite automatizada.
3. Release: PR mas build, empaquetado y smoke test.

## Modulos nativos

`better-sqlite3` y otros binarios deben compilarse para el ABI que ejecuta la
prueba. No considerar un fallo ABI como fallo funcional, pero tampoco marcar el
gate como exitoso: reparar el entorno y repetir.

## Evidencia

Los reportes de un cambio viven en
`openspec/changes/<cambio>/reports/`. Deben incluir comandos, resultado,
excepciones y restauracion de estado cuando hubo mutaciones.

## Regla de baseline

Mientras exista deuda historica de lint o pruebas, todo archivo modificado debe
quedar sin nuevas incidencias y el baseline total debe disminuir. No ampliar ni
ocultar el baseline para conseguir un gate verde.
