# Verificación de errores de credenciales

Fecha: 2026-11-03. Estado local, sin despliegue ni cuentas reales.

Se reprodujeron seis fallos con valores ficticios: RPC fallido tratado como
clave ausente, tipo inválido, errores de guardar/borrar con datos privados,
implementación duplicada y clave en URL. Los casos posteriores cubren también
fallos de red y autenticación y proveedor no compatible. Se conservó el resultado
null para ausencia y se rechazaron fallos para no activar fallback incorrecto.

`npm run verify:pr`: código 0; 6986 pruebas aprobadas y cinco omitidas. Cobertura
sobre 2615 fuentes: líneas 60.24%, sentencias 58.76%, funciones 55.18%, ramas
52.19%. El build aislado pasó; no acredita instalador ni proveedor real. Logs y
respaldos en `%TEMP%/soflia-credential-errors-2026-11-03/`.

Google y Supabase se sustituyeron por puertos simulados: falta comprobar la
validación de cabecera con un proveedor real y revisar independientemente el
cambio. La clave y el SDK siguen en renderer; RLS, RPC remoto e integración con
otras ramas no se verificaron aquí. El fallo RPC ahora requiere reintentar en vez
de usar la clave de entorno; este cambio de comportamiento es intencional.
