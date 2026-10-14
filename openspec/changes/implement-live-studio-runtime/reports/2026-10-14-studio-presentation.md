# Ajuste del panel de sesiones síncronas

Fecha: 2026-10-14. Rama: `codex/simplify-synchronous-studio`.

## Alcance y resultado

La UI propia de Hub usa Conectar sesión/Unirme a la sesión y textos de llamada
en las ayudas de medios y salas. Se retira el badge Realtime y su CSS sin retirar
la suscripción, invalidaciones, presencia ni actualización manual. El aviso de
grabación conserva estados confirmados, interrupciones y reintento. Se elimina
la preferencia de repetición y su operación intent: el usuario autorizado la
administra exclusivamente en Learning. La política automática no cambia.

El runtime SDK y su protocolo aislado se conservan. No se altera el contrato
compartido ni se añaden canales, permisos o capturas automáticas. Los controles
y marcas que renderiza el SDK del proveedor permanecen bajo su implementación.

## Diagnóstico del SDK

Confirmado en Hub: el aviso recibido en la captura corresponde a un error
allowlisted del servidor Learning en `electron/learning-studio-access.ts`. Se
traduce ahora a un diagnóstico de configuración audiovisual administrativa. No
es la comprobación de un paquete faltante en Hub y precede a montar el iframe.

Confirmado en el checkout Learning disponible: `main`, commit `36b4b35c`, sin los
archivos studio/recordings del backend documentado. El módulo antiguo
`apps/web/src/features/live/zoom.server.ts` solicita ZOOM_MEETING_SDK_KEY/SECRET;
el runbook del estudio solicita ZOOM_MEETING_SDK_CLIENT_ID/CLIENT_SECRET.

Confirmado posteriormente mediante lectura remota de la rama citada en el
runbook: [studio-zoom.server.ts](https://github.com/DevOps-043/SofLIA-Learning/blob/codex/live-studio-runtime/apps/web/src/features/live/studio-zoom.server.ts),
blob `eab0b5eb588e834fbb7f035688042ed6fbd5cdac`. `createZoomStudioJoin` comprueba
ZOOM_MEETING_SDK_CLIENT_ID/CLIENT_SECRET y emite exactamente ese error 503 si
falta cualquiera, antes de consultar credenciales de sesión o ZAK. No acepta
alias KEY/SECRET. Queda por comprobar cuál falta en el despliegue vigente.
No se inspeccionaron secretos ni `.env`; no se configuró ni desplegó Learning.
La preferencia en Learning conserva el alcance del cambio de grabaciones: este
ajuste de Hub no acredita que ese panel esté publicado en el servidor vigente.

## Verificación

- Línea base dirigida: 31 pruebas en 5 archivos, exitosas antes de editar.
- Primera verificación del cambio: 41 pruebas en 7 archivos, exitosas.
- Verificación dirigida final: 44 pruebas en 7 archivos, exitosas; añade rechazo
  de propiedades heredadas en el traductor de errores.
- `npm run zoom:build`: exitoso tras instalar su lockfile aislado; antes de esa
  instalación, el typecheck del paquete fallaba por dependencia SDK ausente.
- Primer `npm run verify:pr`: adaptadores, arnés, cadena de suministro, documentos,
  enlaces, semilla y 66 cambios OpenSpec exitosos. Se detuvo en typecheck por
  Object.hasOwn incompatible con el target y por pdfjs-dist ausente.
- Se sustituyó Object.hasOwn por hasOwnProperty.call y se restauraron dependencias
  locales. La instalación inicial sin escritura de lockfile cambió node_modules;
  se repitió instalación desde package-lock mediante npm ci --ignore-scripts
  para conservar las versiones reproducibles, sin alterar dependencias declaradas.
  Windows bloqueó esa restauración con Hub abierto; tras el cierre confirmado
  por el usuario, npm ci instaló 1324 paquetes y npm rebuild terminó correctamente.
  La aprobación automática bloqueó la limpieza de `tmp/studio-deps-20261014`,
  carpeta ignorada creada para intentar una instalación aislada; se conserva sin
  incorporarla a Git. No se intentó eludir el bloqueo.
- Typecheck final del gate: exitoso en renderer y main.
- `npm run verify:pr` final: exitoso. Adaptadores, arnés, cadena de suministro,
  documentación de sistema, enlaces, semilla, 66 cambios OpenSpec, tipos y lint
  incremental aprobados. Suite: 430 archivos aprobados y 2 omitidos; 4392 pruebas
  aprobadas y 5 omitidas. Ninguna prueba de esta entrega acredita ingreso real.
- `node scripts/quality/smoke-zoom-runtime.mjs`: exitoso, origen de carga
  `soflia-zoom://meeting`; no acredita ingreso ni audio/video de una llamada.
- `npm run docs:check` después de actualizar el diagnóstico remoto: exitoso,
  enlaces válidos en 538 documentos. `git diff --check` exitoso y manifiestos/
  lockfiles sin cambios.
- Revisión visual en navegador, fixture localhost:4321: instructor y participante
  muestran los nuevos botones, sin badge ni preferencia. La fixture no implementa
  snapshots de archivo y muestra esa falta de confirmación; no acredita captura
  real, ingreso SDK ni publicación de repeticiones.

## Revisión de riesgos y reversión

Se revisaron traducciones allowlisted, errores no conocidos, propiedades heredadas
del mapa, conservación de autorización académica, no ingreso automático, revocación
de grants al cambiar rol y no envío de intención incluso con can_manage. Las pruebas
de grabación conservan pausa/parada y archivo confirmado sin inventar Grabando.
No se amplía acceso al iframe ni a archivos privados. Se retiró CSS de controles
eliminados. La revisión fue local; no se archivan cambios ni se declara validado
el ingreso a una sesión real.

Reversión: revertir el diff de esta rama. No requiere migración ni modificación
de preferencias, archivos, credenciales o configuración remota.
