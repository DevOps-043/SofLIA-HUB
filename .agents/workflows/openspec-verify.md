# Verificar un cambio OpenSpec

Comprueba completitud, correccion y coherencia con evidencia reproducible.

1. Ejecuta la skill `verify-change` para seleccionar la compuerta proporcional.
2. Como minimo valida OpenSpec, adaptadores, arnes, enlaces, tipos, lint de
   archivos cambiados y pruebas dirigidas.
3. Para un PR ejecuta `npm run verify:pr`; para un candidato de release autorizado
   ejecuta `npm run verify:release`.
4. Ejecuta la skill `adversarial-review` contra permisos, IPC, secretos, datos,
   concurrencia, errores parciales, rollback y bypass de HITL.
5. Separa fallos introducidos de deuda preexistente; nunca declares una prueba no
   ejecutada.
6. Actualiza el reporte de evidencia del cambio con comandos, resultados y riesgo
   residual.
