# Verificación de credenciales nativas para medios

Fecha: 2026-11-05. Estado local, sin credenciales ni transferencias reales.

El wrapper y preload dejaron de recibir o resolver la clave. Main usa la
autoridad Google con sesión Lia vinculada y revalida después de resolverla.
Las pruebas confirman que no se acepta apiKey del renderer y que un cambio de
sesión durante esa espera evita iniciar transferencia. Se conserva el control
de propietario de subidas, consentimiento y resultados obsoletos.

Compuerta `npm run verify:pr`: código 0, 7050 pruebas aprobadas y 5 omitidas;
cobertura en 2629 fuentes: líneas 60.45%, sentencias 58.97%, funciones 55.40%
y ramas 52.39%. Compilación aislada, tipado y lint dirigido pasaron. Logs,
códigos de salida y respaldos: `%TEMP%/soflia-native-media-2026-11-05/`.

No se acredita proveedor, sesión nativa o archivos de usuario reales. Las rutas
locales, transferencia y archivos remotos mantienen sus propios controles.
Otros consumidores Gemini siguen en renderer. Revisión independiente e
integración entre ramas permanecen pendientes; no se archiva ni se deduce un
nuevo porcentaje global de deuda.
