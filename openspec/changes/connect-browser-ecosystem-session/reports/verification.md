# Evidencia de conexión de sesiones

Estado: verificación local completada; publicación autorizada en curso.
Fecha: 2026-10-10. Los resultados del primer estado se conservan como historial.

## Diagnóstico y corrección después de la prueba del usuario

La sonda sin credenciales a producción a las 23:57 UTC recibió HTTP 401 del
middleware anterior en Learning y Project Hub, y HTTP 404 en Engine. Los
endpoints nuevos no estaban publicados. Esto explica el formulario de Learning
reportado por el usuario; el primer reporte local no acreditaba acceso real.

Se corrigió la inferencia de sesión a partir de cookies vencidas. Solo la web
confirma una cuenta válida; los registros antiguos de conexiones se comprueban
de nuevo. La limpieza de cookies en GET y un POST fallido ya no se consideran
cierre explícito. Los cierres elegidos permanecen guardados. La reconexión
explica ahora cuando el endpoint aún no está publicado, sin mostrar tokens.

Validación del estado corregido:

- Hub: siete suites dirigidas, 417 casos aprobados.
- Hub: `npm run verify:pr` completo aprobado; 352 suites aprobadas y una
  omitida, 3753 casos aprobados y uno omitido. Incluye tipos, lint incremental,
  documentación, arnés, supply chain y 43 cambios OpenSpec válidos.
- Ecosistema: cinco suites y 26 casos aprobados tanto en los archivos de
  trabajo como en los tres worktrees aislados destinados a publicación.
- Engine y Project Hub aislados: tipos y ESLint dirigido aprobados.
- Learning aislado: ESLint dirigido aprobado.
- Electron nativo: intercambio/cookies/aislamiento/redirecciones aprobado.

Publicación autorizada explícitamente por el usuario y cuenta Netlify conectada.
Se enviaron a main únicamente los cambios de sesión, preservando cambios Live
y otras modificaciones locales:

- Learning: `26067f17054f33160bb2e6adc44c8672c752abde`, build
  `6acad1ec4f8e250008a041b9`.
- Engine: `64b6696df460255f9915250b7bdb079a4fdd5182`, build
  `6acad1ef7df72c0008aa292f`.
- Project Hub: `cec9f6a35569ef9656d48fc5e1652ff3de7e302d`, build
  `6acad1f2d2d2e700080df7a5`.

Netlify confirmó contexto production y compilación iniciada. Esto todavía no
confirma una versión publicada ni un ingreso con la cuenta real del usuario.

La primera publicación terminó en los tres sitios. La comprobación real detectó
HTTP 403 con el Origin HTTPS correcto; sin Origin, los endpoints respondían
401 y el GET de Project Hub respondía 204. Se ajustó la comparación para admitir
el origen HTTPS del Host público, aunque la URL interna del proxy use HTTP.
Se añadieron regresiones del proxy y rechazo de dominios parecidos: las cinco
suites del candidato corregido pasan ahora 30 casos. Se publica esta corrección
antes de declarar listos los endpoints.

A las 00:09:13 UTC, la sonda con Origin HTTPS público pasó en las tres URLs:
HTTP 401 con `success:false` del endpoint nuevo. Project Hub GET sin puente
respondió HTTP 204 y no-store. Los tres sitios rechazaron un origen ajeno con
HTTP 403. Netlify confirma publicados Engine `f59a62e65be523d78ba3c805e9ae82905032cbaa`
(`6acad33b7b991400087c3fd3`) y Project Hub `86a87b99682c2efa30dae7e5b98b81e76bae2e4c`
(`6acad33ea2618e000700610c`). Learning ya tiene publicado el endpoint inicial;
su revisión `8eb91f34b5097b7cde6c6032a54bc3dc7d0f1ee4` está compilándose en
`6acad337592b72000823be2e`.

La aplicación de PulseHub abierta ya cargó la corrección local. Se pidió al
usuario comprobar «Usar mi cuenta de PulseHub» en Learning, porque un cierre
de sesión previamente guardado no se borra sin esa elección. La confirmación
de ingreso con su cuenta real sigue pendiente; la sonda no usa credenciales.

## Historial de la primera validación local

- Hub: npm run typecheck pasó en el primer estado validado. La compuerta final
  detectó modificaciones concurrentes de Learning Live: cuatro referencias
  onOpened en src/__tests__/app/learning-live-session.test.tsx incompatibles
  con el hook actualizado, y una referencia transitoria en AppContent.tsx.
- Hub: seis suites del canje, servicio, handlers, preload, wrapper y panel:
  404 casos aprobados. La suite adicional de persistencia/aislamiento pasó
  sus ocho casos después de corregir un mock del entorno de pruebas.
- Ecosistema: npx vitest run --config scripts/quality/vitest-ecosystem.config.mts:
  cinco suites, 26 casos aprobados, incluidos logout local de Learning,
  membresía/organización deshabilitada, bearer inválido, orígenes cruzados,
  cuerpos malformados/grandes, preservación de cuentas y puente revocado.
  El store real de Project Hub consume la sesión local, conserva/renueva otra
  cuenta cuando no hay puente y mantiene cerrado un sitio sin credenciales.
- Electron nativo: node node_modules/electron/cli.js scripts/quality/smoke-browser-ecosystem-session.cjs,
  aprobado. Servidor local con credenciales ficticias; confirma cookies
  HttpOnly antes de la navegación, conservación de cookies previas,
  aislamiento de particiones y rechazo de redirecciones.
- Engine: npm run test:auth-bridge, 15 contratos existentes aprobados.
  npx tsc --noEmit --incremental false, aprobado.
- Project Hub: npx tsc --noEmit --incremental false, aprobado.
- Learning: npm run type-check:app -- --incremental false: 302 diagnósticos
  generales, ninguno en el endpoint, sus pruebas, session.service.ts ni
  proxy/api-route-auth.ts. Los primeros errores de CompanyEditCard e InputField
  ocurren en archivos sin diferencias frente a HEAD.
- ESLint dirigido de los archivos modificados en las tres webs, aprobado.
  ESLint de los módulos nuevos, pruebas y scripts de Hub, aprobado.
- Hub: npm run lint:changed detectó tres errores y una advertencia ajenos en
  src/components/learning-live/useLearningWorkspace.ts (refs en render) y
  src/services/learning-live-service.ts (variable sin uso); ninguna incidencia
  incremental en los archivos de este canje.
- Hub: npm run test completo: 349 suites aprobadas, una fallida y una omitida;
  3737 casos aprobados, cuatro fallidos y uno omitido. Los cuatro fallos están
  en learning-live-session.test.tsx por el cambio de contrato onOpened.
- Gate Hub: npm run verify:pr aprobó adaptadores, arnés, cadena de suministro,
  documentación de sistema/enlaces, seed y las 43 especificaciones. Se detuvo
  en los errores de tipos de Learning Live descritos arriba. No se declara
  aprobada la compuerta global ni se modifican esos archivos ajenos.

## Revisión de hipótesis de seguridad y concurrencia

Se intentó refutar el envío a dominios parecidos, subdominios, puertos ajenos,
URLs con credenciales y HTTP no autorizado: el canje no obtiene ni envía identidad.
Guest/private no acceden a SOFIA. IPC rechaza frame secundario, otra ventana,
sesión cerrada y argumentos con destinos/credenciales.

Dos pestañas comparten canje. Cambiar de cuenta cancela la operación y evita
persistir éxito. Sesión previa, cierre explícito y expiración de su cookie
conservan la elección tras reiniciar. Un cierre en un alias protege el otro.
La revisión de navegación se ejecuta antes del intercambio de identidad.

Se corrigió el logout global de Learning para las sesiones creadas por este
canje: conserva PulseHub y otras sesiones SOFIA. Se añadieron verificación de
identidad final en Engine y rechazo de refresh tokens en el puente de Project Hub.

## Límites de la evidencia

Los endpoints se ejercitaron con Auth y bases de datos simulados. No se usaron
cuentas, contraseñas o claves de producción, ni se publicaron webs o Hub.
No se modificó el esquema remoto. La activación requiere publicar los cuatro
componentes y comprobar la [matriz de staging](../integration.md).

La sesión existente de cada web conserva su propio mecanismo de renovación.
Si requiere autenticación nuevamente, el usuario conserva el gestor de
Contraseñas, otra cuenta y la reconexión explícita de PulseHub.
