# Verificación parcial: canales heredados

Fecha: 2026-11-03. Rama local `codex/reduce-technical-debt`. Esta evidencia no acredita integración con otras ramas, despliegue ni revisión independiente.

- `npm run verify:pr`: aprobada, 6943 pruebas Vitest aprobadas y 5 omitidas; 62 pruebas de tooling y pruebas Python incluidas. Cobertura: 2615 fuentes, líneas 59.87%, sentencias 58.46%, funciones 54.87% y ramas 52%.
- `npm run app:smoke:build`: compilación aislada aprobada; no acredita instalador, inicio, cuentas ni proveedores reales.
- Cinco pruebas dirigidas adicionales verifican cancelación, cambio de actor y eliminación segura del token Telegram. La suite previa de canales aprobó 99 casos dirigidos.
- La primera compuerta se detuvo por inventario documental desactualizado; tras sincronizarlo, otra ejecución identificó un Python temporal incompleto. Se usó Python 3.12.10 aislado y la ejecución posterior aprobó.
- Logs: `%TEMP%/soflia-legacy-channels-2026-10-30/gate-nov03-python.log` y `build-nov03.log`.

Quedan pendientes pruebas adicionales de las cuatro capas y revisión adversarial independiente, documentación y reconciliación de los cambios locales con la rama de integración. El rol de administrador cubre el dispositivo compartido y no demuestra aislamiento físico por organización. No se recalculó el porcentaje global de deuda técnica.

## Integración de cuatro capas — 2026-11-03

Se agregaron 19 casos que conectan los wrappers del renderer, el preload con
allowlist y los handlers registrados a servicios y autorización simulados.
Cubren las 15 rutas heredadas, fechas, canal no permitido, rol sin permisos y
cancelación de aprobación. No realizan acciones con cuentas o proveedores reales.

La compuerta final `npm run verify:pr` aprobó con 6962 pruebas Vitest, cinco
omitidas y cobertura de 2615 fuentes: líneas 59.90%, sentencias 58.48%,
funciones 54.98% y ramas 52%. El primer intento con la prueba nueva detectó
errores de tipado de los fixtures; se corrigieron y se repitió la compuerta.
El build aislado anterior permanece aplicable al código productivo, que no cambió
durante esta ampliación de pruebas. Registro: `%TEMP%/soflia-legacy-channels-2026-10-30/gate-four-layer-typed.log`.

La revisión independiente, documentación restante y reconciliación con main
siguen pendientes. El porcentaje global de deuda no se ha recalculado.
