# Verificación de Flow nativo

Fecha: 2026-11-05. Estado local; sin despliegue ni proveedores reales.

Electron ejecuta análisis, fallback y transcripción mediante `ai:gemini-flow`;
main selecciona el modelo, construye los prompts y resuelve la clave nativa.
El renderer conserva la ruta autónoma y detiene reintentos tras revocación.
Las pruebas dirigidas verifican cuatro capas, operaciones permitidas, emisor,
sesión, concurrencia, proveedor simulado y compatibilidad. Una prueba adicional
reprodujo la falta de rechazo temprano de audio excesivo: ahora se limita a
12 MiB antes de leerlo y se comparte el límite base64 de 16 MiB con main.

Compuerta final `npm run verify:pr`: código 0, 7043 pruebas aprobadas y cinco
omitidas, cobertura en 2629 fuentes: líneas 60.42%, sentencias 58.94%, funciones
55.36% y ramas 52.36%. `npm run app:smoke:build`: código 0. Recibos y logs en
`%TEMP%/soflia-native-flow-2026-11-03/gate-nov05.log`, `gate-nov05.exit`,
`build-nov05.log` y `build-nov05.exit`. El intento anterior quedó sin resultado
recuperable y no se contó como aprobado.

Otros consumidores Gemini siguen usando renderer; la clave no está retirada de
todo el producto. Cancelación no revierte I/O enviado. No se probaron cuentas,
servidor real, instalador o GUI. Revisión independiente e integración de ramas
siguen pendientes. No se recalculó el índice global de deuda técnica.
