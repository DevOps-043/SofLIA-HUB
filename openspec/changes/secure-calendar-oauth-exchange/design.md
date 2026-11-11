## Context

Ver propuesta y context-pack. Sólo Microsoft consume MSAL. La configuración
actual expone clientId, no credencial confidencial; el SDK instalado rechaza
esa construcción con invalid_client_credential. Google/Microsoft comparten un
callback GET localhost:8234/callback y custodia cifrada por dueño. No hay state,
PKCE o control de método/ruta/host; el servidor puede fallar después de abrir
ventana. Las guardas de servicio ya detectan A/B/A y deben conservarse.

## Goals / Non-Goals

**Goals:** SDK parcheado, intercambio vinculado al intento/sesión y recursos
con cierre físico; separación entre pruebas criptográficas, HTTP y UI nativa.

**Non-Goals:** renovar Microsoft/persistir cache MSAL, quitar secretos Google
sin contrato de backend, modificar scopes/registros/URI o probar cuentas reales.

## Decisions

- MSAL 7.1.1 (MIT, Node >=20, sin hooks nuevos), resolver/revisar lock e instalar
con ignore-scripts. La guía v7 conserva getAuthCodeUrl y los flujos manuales;
no usar acquireTokenInteractive ni su callback form_post. Fijar query en la
petición manual Microsoft, misma URI/autoridad/scopes. PublicClientApplication
evita exigir un secreto a la app nativa. Nonce OIDC se entrega explícitamente
en AuthorizationCodeRequest para validar el token de respuesta, conforme al
contrato 7.1.1; no se copian campos libres del callback como payload del SDK.
- Módulo de prueba de intento con state/verifier aleatorios de 32 bytes y
challenge SHA256/base64url, inmutable y sólo en memoria. Google también usa
state/PKCE al construir URL y canjear código. No se añaden scopes.
- Abrir autorización en navegador del sistema conforme RFC 8252. Mantener
openOAuthWindow como fachada main, ahora con opciones de proveedor/prueba/guard.
Comprobar HTTPS, origen/ruta permitidos, ausencia de credenciales/fragmento,
state/challenge/método/redirect/type únicos antes de shell.openExternal.
Ventana local sandbox de estado, sin remoto/preload/script, permite cancelar
con su cierre. No observar cookies ni cerrar la pestaña del navegador externo.
- Receptor HTTP independiente: escuchar sólo 127.0.0.1 antes de abrir UI o
navegador; puerto producto 8234. Factory interna admite puerto cero para QA,
sin exponerlo en IPC. Estado de ready devuelve booleano, resultado código/null;
error de bind no deja un rechazo de promesa sin consumidor. Cancelación antes
de listening espera el cierre cuando el bind termine, sin declarar éxito antes.
- GET y /callback exactos, Host localhost/127.0.0.1 con puerto real, URI relativa
sin ambigüedad y state único igual en tiempo constante. Code único visible,
no vacío, máximo 8192 caracteres y sin esquema URL/control/espacios. Callback
inválido responde 4xx sin consumir el intento; error OAuth con state válido
termina sin éxito y sin reflejar descripción. Contexto inválido termina sin
intercambio; después de cada espera los servicios revalidan antes de efectos.
- URL hasta 16 KiB, headers 8 KiB/32, cuatro conexiones, request/headers 5 s,
keepalive 1 s y vida del intento 300 s. Ready/bind acotado a 5 s. Cleanup
idempotente: timers/listeners, servidor y conexiones propias, ventana local y
suscripción auth. Resultado sólo tras cierre físico del listener. No se borran
datos de otros perfiles ni se promete controlar un navegador externo abierto.
- Auth-state revoca intentos pendientes; una solicitud de canje ya iniciada
puede completar en proveedor, pero sus resultados se descartan si perdió
contexto. Sesión/actor se comprueban antes de canje, persistencia y evento.
- Regresiones puras, HTTP local real, ventana/shell simulados, SDK nuevo con
transporte/metadata ficticios y smoke Electron con shell sustituido. No abrir
login real ni ejecutar exploits. Custodia y cuatro capas existentes se prueban
sin duplicar contratos de credenciales.

## Risks / Trade-offs

Navegador externo cambia UX: la ventana local permite cancelar; no cierra el
tab externo. Puerto fijo puede estar ocupado: fallo visible sin abrir browser,
sin cambiar registros de proveedores ni matar al dueño del puerto. Nuevas
validaciones rechazan callbacks incompletos antiguos. SDK/mocks no certifican
tenant, consentimiento o acceso Graph real. Persiste renovación Microsoft y
deuda de secreto Google, sin declarar esas áreas resueltas.

## Migration Plan

Pruebas rojas y baseline/advisories; lock revisado/instalación sin hooks;
pruebas de intento/receiver, fachada nativa y servicios; transporte SDK real
sin red; documentación, autorrevisión y gate/build estable. Revisión
independiente antes de archivar. Mantener credenciales existentes y cancelar
intentos antiguos al reiniciar; rollback a SDK parcheado y pruebas vinculadas,
no al callback sin state o al cliente confidencial sin secreto.
