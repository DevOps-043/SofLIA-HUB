# Activación de acceso automático del ecosistema

Estado: implementado y verificado localmente; publicación y staging pendientes.

Publicar Learning, Engine y Project Hub con POST /api/auth/hub-session y luego
distribuir Soflia Hub actualizado. Project Hub también publica GET del mismo
endpoint y el arranque del store cliente. Usan las configuraciones Auth actuales;
no requieren compartir cookies entre dominios ni nuevas claves o migraciones.

Destinos de producción del menú: https://soflia.ai,
https://soflia-coursegen.netlify.app y https://sofliahub.netlify.app.
Los alias www.soflia.ai e irisia.netlify.app están explícitamente permitidos.
El origen configurado de Learning puede ser HTTPS o loopback HTTP para desarrollo.
Un redireccionamiento del POST se rechaza: el endpoint debe responder en el
origen definitivo, también cuando se usan alias.

La sesión web se guarda en el perfil persistente del usuario. Al cerrar la
aplicación y volver a abrirla, el sitio conserva sus mecanismos de sesión y
refresh. Después de cerrar sesión puede usarse el gestor de Contraseñas del
navegador, otra cuenta o «Usar mi cuenta de Soflia Hub» en Herramientas del
navegador. Un fallo de conexión conserva el login normal.

## Matriz de aceptación en staging

1. Cuenta autorizada A en Hub, perfil autenticado limpio: abrir las tres webs y
   comprobar identidad A sin escribir contraseña.
2. Cerrar y reiniciar Hub: comprobar continuidad de sesiones y refresh del sitio.
3. Logout de una web: navegar, abrir nueva pestaña y reiniciar; debe seguir cerrada.
4. Entrar manualmente con B: navegar y renovar su sesión; debe conservar B.
5. Seleccionar «Usar mi cuenta de Soflia Hub»: debe pasar de B a A.
6. Cambiar de usuario en Hub y probar perfiles invitado/privado: aislamiento completo.
7. Suspender usuario/membresía/organización: no debe emitirse una sesión nueva.
8. Endpoint no disponible, redirección, demora y navegación cancelada: login
   habitual disponible y ninguna credencial en URL, UI o logs.

La verificación local se registra en [el reporte](reports/verification.md).

## Comprobación de las webs publicadas

Desde Hub ejecutar `node scripts/quality/check-ecosystem-session-readiness.mjs`.
La sonda no envía cuentas, cookies ni credenciales. Cada POST sin bearer debe
recibir HTTP 401 y JSON `{"success":false}` del endpoint nuevo. Un 401 del
middleware anterior, un 404 o un redirect bloquean la activación. El resultado
esperado solo confirma que la ruta está publicada; después se ejecuta la matriz
con una cuenta autorizada.
