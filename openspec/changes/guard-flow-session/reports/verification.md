# Verificación de vigencia de Flow

Fecha: 2026-11-03. Cambios locales con proveedores simulados.

Dos pruebas reprodujeron el reintento de Flow y la publicación de transcripción
tras cambiar de sesión. Las pruebas posteriores comprueban también el descarte
de análisis tardío y la recuperación normal con sesión vigente. La guarda observa
la sesión durante análisis, fallback y transcripción y libera su suscripción.

`npm run verify:pr` aprobó: 7023 pruebas aprobadas y 5 omitidas. Cobertura en
2623 fuentes: líneas 60.36%, sentencias 58.88%, funciones 55.28%, ramas 52.27%.
Tipado, lint dirigido y especificación también pasaron. Evidencia y respaldos:
`%TEMP%/soflia-flow-session-2026-11-03/`.

Las llamadas ya enviadas no se revierten; Flow continúa usando Gemini en el
renderer. No se verificó con servidor o cuentas reales. Quedan pendientes la
revisión independiente, integración entre ramas y migración de Flow a main.
