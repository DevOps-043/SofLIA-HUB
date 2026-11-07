# Verificación de lecturas directas de claves

Fecha: 2026-11-03. Estado local, sin despliegue ni cuentas reales.

Dos pruebas reprodujeron que `getApiKey` devolvía una clave anterior tras un
cambio de sesión o una invalidación. Se movió la revisión a la guarda compartida
para cubrir la lectura directa y las fachadas sin duplicar listeners; también se
verificó invalidación de una consulta personal y la compatibilidad con las
mutaciones y clientes existentes. Los RPC y eventos se simularon.

`npm run verify:pr`: código 0, 6997 pruebas aprobadas y cinco omitidas. Cobertura
sobre 2616 fuentes: líneas 60.25%, sentencias 58.78%, funciones 55.20%, ramas
52.21%. `npm run app:smoke:build`: código 0, sin acreditar instalador o cuentas.
Logs, caso inicial y respaldos: `%TEMP%/soflia-direct-key-2026-11-03/`.

La guarda es local a la ventana y no sustituye autorización del servidor. No
cancela operaciones ya enviadas ni retira claves Gemini del renderer. Permanecen
pendientes validación con sesión y servidor reales, revisión independiente e
integración con otras ramas. No se recalculó el índice global de deuda.
