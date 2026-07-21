---
name: verify-change
description: Selecciona y ejecuta verificación proporcional al riesgo de un cambio, desde pruebas dirigidas hasta compuertas de PR o release. Úsala después de implementar, antes de declarar un arreglo resuelto o al reunir evidencia para un pull request.
---

# Verificar un cambio

1. Convertir los criterios OpenSpec en una matriz de casos felices, errores, límites y permisos.
2. Ejecutar primero las pruebas más cercanas al código modificado.
3. Ejecutar `npm run typecheck`, `npm run harness:validate` y `npm run docs:check`.
4. Ejecutar `npm run lint:changed` para impedir deuda nueva sin confundirla con la línea base histórica.
5. Ejecutar `npm run verify:pr` antes de entrega y `npm run verify:release` solo para candidatos a release.
6. Comparar cada resultado con la línea base; separar regresiones de fallos preexistentes.
7. Guardar comandos, resultados, casos negativos y riesgo residual en el reporte del cambio.

Nunca afirmar que una compuerta pasó si no se ejecutó en el estado actual del worktree.
