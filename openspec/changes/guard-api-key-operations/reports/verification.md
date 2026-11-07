# Verificación de operaciones de claves y sesión

Fecha: 2026-11-03. Estado local, sin despliegue ni cuentas reales.

Cinco pruebas reprodujeron que lecturas y mutaciones continuaban o publicaban
resultados de la sesión anterior. Tras la guarda, las pruebas cubren cambio de
sesión antes de consultar/escribir, lectura tardía, guardado y eliminación ya
enviados, limpieza de suscripciones y fallos de identificación. Se usan puertos
simulados y una guarda compartida por lecturas y mutaciones.

`npm run verify:pr`: código 0; 6993 pruebas aprobadas y 5 omitidas. Cobertura en
2616 fuentes productivas: líneas 60.25%, sentencias 58.78%, funciones 55.19% y
ramas 52.21%. `npm run app:smoke:build` aprobó sin acreditar instalador o cuentas.
Logs y respaldos: `%TEMP%/soflia-key-operations-2026-11-03/`.

Si una escritura ya salió, el resultado es incierto: no se afirma su reversión.
La guarda es local a la ventana y no sustituye RLS o validación de JWT. Falta
validación con servidor y sesión reales, revisión independiente e integración con
otras ramas; el porcentaje global de deuda no se recalculó.
