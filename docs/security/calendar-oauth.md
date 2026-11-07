# Autorización OAuth de calendarios

Estado: vigente. Actualizado: 2026-10-24.

## Intento y responsabilidades

Google y Microsoft se autorizan en el navegador del sistema. El Hub muestra una
ventana local de estado; cerrarla cancela la espera. Esa ventana tiene sandbox,
aislamiento de contexto, Node desactivado y CSP sin scripts ni red. No carga la
página del proveedor ni recibe código, tokens o prueba PKCE. La pestaña externa
pertenece al navegador del usuario y puede permanecer abierta tras cancelar.

`electron/calendar/oauth-proof.ts` crea por intento un state y un verificador
aleatorios de 32 bytes, con desafío SHA256/S256. Valida destino HTTPS exacto del
proveedor, client_id, redirect_uri, response_type, state y desafío únicos antes
de `shell.openExternal`. Microsoft añade nonce aleatorio y lo entrega también
al canje de código: MSAL valida su correspondencia. Usa PublicClientApplication
sin secreto de cliente. Ambos proveedores canjean con el verificador original.

`oauth-receiver.ts` posee el servidor HTTP y sus plazos; `oauth-window.ts` coordina
ventana, navegador y revocación. Los módulos Google/Microsoft conservan captura
de sesión, dueño, configuración y guardas antes/después de esperas y persistencia.
No se amplían los scopes existentes ni se introduce IPC. La custodia sigue en
el [almacén del calendario](../operations/configuration.md#custodia-del-calendario).

## Receptor local

La URI registrada sigue siendo `http://localhost:8234/callback`; el listener
se enlaza sólo a IPv4 `127.0.0.1`. Debe estar listo antes de abrir el navegador.
Sólo admite GET, Host localhost/127.0.0.1 con ese puerto, ruta callback y state
único de 43 caracteres base64url, comparado en tiempo constante. Rechaza códigos
vacíos, repetidos, URLs, controles o respuesta con code y error simultáneos.
Un error OAuth con state correcto cancela sin reflejar su descripción.

Las solicitudes inválidas reciben 4xx y permiten continuar el intento legítimo.
La respuesta es estática, no almacenable y sin reflejar códigos ni datos del
proveedor. Una respuesta válida reclama el intento una sola vez. Timeout,
cancelación, fallo de bind/apertura o pérdida de sesión retiran conexiones y
ventana; el resultado espera al cierre físico del listener. La cancelación
funciona también durante loadURL o una apertura externa pendiente.
Un segundo intento con el puerto ocupado falla sin abrir otro navegador.
Los [parámetros](../architecture/runtime-parameters.md#autorización-oauth-del-calendario)
definen los presupuestos, que no constituyen un SLO.

## Verificación y límites

Las pruebas Vitest cubren TCP real, entradas ajenas, cancelación, sesión A/B/A,
configuración tardía y canje. La suite SDK usa MSAL/Google reales con transporte
ficticio; sus JWT sin firma son fixtures de nonce, no evidencia de autenticación.
`npm run calendar:oauth:smoke:native` carga la fachada en Electron real, en perfil
temporal, bloquea red externa y sustituye sólo la apertura de navegador. Comprueba
sandbox, callback, liberación del puerto/ventana y rechazo de destino ajeno.
No accede a cuentas reales ni acredita consentimiento, registro de cliente,
canje remoto, Graph, caché persistente Microsoft o plataformas no ejecutadas.

MSAL está fijado en 7.1.1 por
[GHSA-xcx6-jx8p-x3h5](https://github.com/AzureAD/microsoft-authentication-library-for-js/security/advisories/GHSA-xcx6-jx8p-x3h5).
La elección de navegador externo y PKCE sigue [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html).
La migración conserva el flujo manual getAuthCodeUrl/acquireTokenByCode; el
cambio a form_post de acquireTokenInteractive no gobierna este flujo.

Persisten los scopes amplios y el client secret de Google incorporado al build,
la renovación Microsoft no persistida y los límites de red propios de cada SDK.
Cambiar esas capacidades requiere contratos de proveedor y verificación propia.
El listener local no protege frente a un sistema operativo comprometido. La
revocación impide guardar un resultado obsoleto, pero no revierte peticiones que
ya llegaron al proveedor.
