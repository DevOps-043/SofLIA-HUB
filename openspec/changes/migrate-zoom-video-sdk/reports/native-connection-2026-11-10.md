# Conexión nativa Video SDK

Estado: conexión real verificada en desarrollo; importación de un MP4 pendiente.
Fecha: 2026-11-10, America/Mexico_City.

## Diagnóstico confirmado

El aviso sobre capacidad de la cuenta anfitriona procedía de la sesión histórica
`39196c76-711f-45b5-b6ea-f7b7db508f8d`, cuyo proveedor persistido es `zoom-meeting`.
La comprobación `verifyRecordingHost` de Learning valida licencia y grabación de
Meetings; no se ejecuta para el ingreso Video SDK. No se cambió el proveedor de
esa sesión ni se retiraron sus controles.

La primera prueba Video SDK había quedado en Empresa Demo (`pulsehub`). Se creó
por el formulario normal del instructor una prueba en SofLIA (`soflia`):
`79fdbc43-49e9-4ba2-a9aa-17416dcbb015`, «Prueba Video SDK · SofLIA · 10 noviembre».
La consulta de control confirmó `zoom-video`, el instructor esperado y la misma
organización usada por el Hub. Se abrió desde la agenda del instructor del Hub.

La autorización audiovisual del servidor pasó. Después se detectaron tres
problemas locales sucesivos:

- Faltaba `dist/zoom-runtime`; se generó con `npm run zoom:build:prepared`.
- La CSP bloqueaba `https://zoom.us/wc/lsdk` porque solo incluía subdominios de
  Zoom. Se añadieron los dos dominios raíz HTTPS oficiales a `connect-src`.
- Video SDK 2.6 ignora rutas de assets que no sean HTTP(S). La ruta nativa
  activaba el fallback legado del proveedor y provocaba
  `isSupportLimitResolutionNormalSharing is not a function`. El esquema nativo
  usa ahora `Global`, que deriva los assets HTTPS de la versión instalada;
  las vistas web HTTP(S) conservan recursos locales.

La CSP sigue rechazando orígenes arbitrarios. No se añadieron permisos de
captura, credenciales, IPC ni accesos a archivos generales.

## Evidencia y verificaciones

Después de recompilar el runtime y reabrir el aula, la interfaz real del Hub
mostró «Sesión conectada», «Grabación en curso» y «1 participantes: Fernando
Suarez». Cámara y audio seguían sin activar. Esto acredita ingreso real y
confirmación de grabación del SDK, no un MP4 ya archivado.

- `vitest run electron/__tests__/zoom-protocol.test.ts src/__tests__/services/zoom-video-runtime.test.ts`: 10 pruebas aprobadas en dos archivos.
- ESLint de los cuatro archivos de código/pruebas modificados: aprobado.
- TypeScript del renderer y main: aprobado; compilación de tipos del paquete
  runtime incluida en `zoom:build:prepared`, aprobada.
- Smoke nativo: `SDK_READY_ORIGIN=soflia-zoom://meeting;VIDEO_ASSETS=true`.
- `harness:validate`, `docs:check` y `git diff --check`: aprobados.
- Intento de `verify:pr`: 65 pruebas de tooling aprobadas; se detuvo en
  `python-tools:test` por falta de Python 3.12. Este intento precede al ajuste
  final de assets; no se presenta como una compuerta completa del diff final.

## Revisión adversarial y límites

Se revisaron el caso de sesión histórica, separación de proveedores, dominios
HTTPS explícitos, rechazo de orígenes ajenos y rutas de assets por esquema.
Se mantienen sandbox, aislamiento de contexto y validaciones del protocolo.
El iframe nativo depende del CDN HTTPS oficial para los assets de Video SDK.
El smoke local no demuestra disponibilidad del proveedor en otra red.

Está pendiente generar contenido audiovisual, cerrar la prueba e importar su
MP4 mediante Actions para verificar almacenamiento y reproducción privada.
No se activaron dispositivos reales sin autorización específica. Al final de
la revisión, Computer Use exigió actualizar la extensión de Chrome y dejó de
permitir continuar el control. No se borraron las dos sesiones de prueba.

## Reversión

Revertir los dos cambios de producción y recompilar el runtime restaura el
comportamiento anterior. No hay migraciones ni mutaciones de credenciales.
