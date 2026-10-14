# Diseño de la conexión de sesiones

Estado: implementado en el código local; publicación pendiente.

## DEC-ECO-001 Canje en main

El proceso main obtiene la sesión SOFIA validada de la cuenta de Soflia Hub.
Antes de la navegación principal, aplica las políticas del navegador y hace
POST al endpoint fijo del origen permitido usando Session.fetch de la misma
partición. Chromium recibe las cookies antes de enviar la navegación. Preload
y renderer nunca reciben el bearer, la contraseña ni el refresh de Soflia Hub.
No se modifican sesiones de Chrome o Edge.

La red rechaza redirecciones del canje, limita la espera a 15 segundos y vuelve
a comprobar perfil, usuario y documento. Un cambio de cuenta aborta la petición.
Un fallo conserva el login habitual y limita el reintento automático por un
minuto. Dos pestañas del mismo usuario/origen comparten un canje.

## DEC-ECO-002 Sesiones propias de cada sitio

Learning valida el bearer con Auth, el perfil no suspendido y una membresía
activa en una organización activa; genera y canjea una prueba magic link
usando el servicio SSO existente. Su sesión web es independiente de Soflia Hub.
Una cookie HttpOnly marca estas sesiones para que logout revoque únicamente
la sesión web y conserve el escritorio y otros dispositivos.
Engine valida la identidad SOFIA y reutiliza su Auth Bridge sin contraseña.
Project Hub valida SOFIA y sincroniza solo organizaciones activas antes de
emitir su par de tokens local mediante el pipeline existente.

Project Hub usa una cookie HttpOnly de 60 segundos como puente hacia su store
cliente. GET del mismo sitio comprueba el token de acceso, su cookie y la sesión
local activa antes de entregar únicamente las credenciales propias de Project
Hub y eliminar el puente. Su flujo habitual conserva y renueva esa sesión.
Los tres POST validan origen, header de integración, bearer y un cuerpo de
máximo 128 bytes; aplican límites de frecuencia y responden sin credenciales.
La comprobación admite el origen HTTPS del Host público cuando Netlify
reconstruye una URL interna HTTP. No confía en encabezados Forwarded enviados
por el cliente; un origen ajeno sigue rechazado antes de validar Auth.
No se requieren tablas nuevas, cambios de claves o migraciones.

## DEC-ECO-003 Elección del usuario

El registro por perfil solo contiene orígenes conectados y cierres de sesión.
Una conexión confirmada o sesión preexistente suspende futuros canjes automáticos,
incluso si posteriormente expira la cookie de acceso. El sitio mantiene su
propio mecanismo de refresh y sus cuentas guardadas. Así, una cuenta elegida
en la web nunca se sustituye automáticamente por la de Soflia Hub.

Solo el servidor confirma una sesión existente; la presencia de una cookie
por sí sola no valida la identidad. Los registros anteriores de conexiones
inferidas de cookies se vuelven a comprobar, conservando los cierres elegidos.

Los POST de logout y respuestas POST exitosas que eliminan cookies de sesión
dejan un cierre persistente. La limpieza de cookies vencidas en GET y una
rotación de cookies no se confunden con logout. Los alias de
Learning y Project Hub comparten este bloqueo. La reconexión «Usar mi cuenta de
Soflia Hub» solicita replace=true desde la pestaña activa y recarga el sitio.
El IPC admite cero argumentos y exige el frame principal autenticado. Los
perfiles invitado y privado no reciben identidad de Soflia Hub.

## LIM-ECO-001 Verificación y publicación

Las pruebas locales cubren contratos con Auth simulado y el comportamiento real
de cookies/redirecciones de Electron. No acreditan ingreso contra producción,
proveedores externos o una cuenta real. Publicar los endpoints y el nuevo Hub,
y ejecutar la matriz de staging de integration.md, completa la activación.
La sonda sin credenciales check-ecosystem-session-readiness.mjs distingue el
endpoint nuevo de un 404, una redirección o el middleware anterior; no prueba
el ingreso de una cuenta real.
