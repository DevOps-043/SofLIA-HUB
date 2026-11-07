# Verificación de vigencia de claves en renderer

Fecha: 2026-11-03. Estado local, sin despliegue.

La prueba inicial reprodujo cuatro fallos: mezcla entre proveedores, respuestas
obsoletas tras cierre o transición A/B/A e invalidación de una lectura pendiente.
Las pruebas posteriores verifican además INITIAL_SESSION, liberación del listener,
y guardar/borrar mediante puertos simulados. Una consulta revocada rechaza antes
de que el consumidor pueda recurrir al fallback de entorno.

`npm run verify:pr` terminó con código 0: 6977 pruebas aprobadas y 5 omitidas.
Cobertura de 2615 fuentes: líneas 60.17%, sentencias 58.71%, funciones 55.16%
y ramas 52.15%. `npm run app:smoke:build` también terminó con código 0. Logs y
respaldos: `%TEMP%/soflia-key-session-2026-11-03/`.

La revisión local no sustituye revisión independiente. Las pruebas usan RPC y
sesiones simulados; no se verificó con una cuenta ni una base real. Los eventos
se escuchan por operación en esta ventana; acciones ya iniciadas y otras ventanas
mantienen sus propios ciclos de vida. El SDK y claves Gemini todavía están en el
renderer, y el servidor sigue siendo responsable de la autorización. La retirada
de caché añade consultas RPC; falta medir impacto con uso real.
