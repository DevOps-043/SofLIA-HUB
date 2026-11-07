# Verificación de OAuth de calendario

Estado: implementación y verificación final aprobadas; revisión independiente pendiente.
Fecha: 2026-10-24. Rama: codex/reduce-technical-debt. Unidad 23, acumulativa.

## Problema y evidencia previa

MSAL 5.5.0 instalado rechazó construir ConfidentialClientApplication sólo con
clientId: invalid_client_credential, sin red. La regresión HTTP contra la fachada
anterior recibió 200 al enviar state ajeno, cuando exigía 403. Logs locales:
%TEMP%/soflia-calendar-oauth-2026-10-24/confidential-baseline.json y callback-red.log.
Son reproducciones controladas, sin cuenta real ni exploit contra un proveedor.

[Advisory oficial](https://github.com/AzureAD/microsoft-authentication-library-for-js/security/advisories/GHSA-xcx6-jx8p-x3h5),
[migración v6](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/v6-migration.md),
[migración v7](https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/v7-migration.md)
y [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) sustentan el cambio.
El advisory tiene severidad moderada del mantenedor; npm clasifica este paquete
como high. El flujo manual getAuthCodeUrl/acquireTokenByCode conserva query;
no se usa acquireTokenInteractive, cuyo callback cambia a form_post.

## Dependencias y cambio

Pin MSAL 7.1.1 y common 16.14.3, cliente público sin secreto Microsoft, state y
PKCE S256 por intento y nonce validado durante canje. Google comparte proof y
receiver, con los mismos scopes/URI. Fachada main abre sólo destino permitido
en navegador del sistema y una ventana local sandbox sin proveedor ni datos
OAuth. El receptor escucha antes de UI, valida frontera HTTP y espera cierre
físico de sus conexiones antes del resultado. Sesión/configuración se revalidan
al regresar de esperas, antes de persistir y emitir connected.

Sólo cambiaron dos entradas de paquetes del lock. npm install --ignore-scripts
inicial informó al día pero dejó ambas versiones físicas antiguas. Se verificaron
rutas absolutas y se trasladaron esos dos directorios y el lock oculto de npm
al temporal de esta unidad; reinstalar sin hooks dejó versiones físicas nuevas.
No se eliminaron ni recorrieron dependencias ajenas. La revisión del cierre y
auditoría se registra en [dependency-evidence.json](dependency-evidence.json):
19 a 18 paquetes afectados, high 11 a 10, moderate 8; omit=dev igual; sin nuevos
paquetes afectados. No cambia ningún otro paquete del lock.

## Matriz de comprobaciones

| Frontera | Evidencia ejecutada | Límite |
|---|---|---|
| Proof/destino | Aleatoriedad, inmutabilidad, hash, state/client/redirect duplicados o ajenos, URL/código inválido | Pruebas locales |
| HTTP | TCP real: path/Host/método/state/code, timeout, bind ocupado, cancelación antes de listening, socket incompleto | No es prueba de carga del SO |
| Fachada | Ventana local, cancelación durante loadURL/openExternal pendientes, error, revocación y retry sin recursos retenidos | Ventana/shell simulados en Vitest |
| Conectores | Microsoft público/nonce y ambos PKCE; éxito/cancelación/configuración tardía, A/B/A en ventana/canje, custodia fallida | SDK simulados en integración de servicio |
| SDK | MSAL/Google reales, URL autorizada y canje con verifier; nonce incorrecto rechazado | Transporte ficticio y JWT sin firma de QA; no prueba identidad |
| Electron | Ocho comprobaciones de fachada, sandbox, TCP, retiro de ventana/puerto y destino ajeno | Electron real 44.9.3 Windows; shell sustituido, sin login remoto |

`npm run typecheck` y lint enfocado aprobaron. Nueve archivos dirigidos aprobaron
127 casos, incluidos dos rechazos HTTP adicionales. El inventario fue sincronizado
con npm run docs:inventory:sync: 678 archivos. OpenSpec strict del cambio
y docs:check aprobaron; 717 Markdown activos con enlaces válidos.

Prueba nativa: `npm run calendar:oauth:smoke:native`, recibo
[native-summary.json](native-summary.json). La primera ejecución terminó al cerrar
la última ventana antes de escribir el recibo. El fixture mantiene el proceso
activo con window-all-closed y registra explícitamente errores; la repetición
aprobó. No se cambió el producto para acomodar esa salida de QA. La ventana es
nativa y oculta; se sustituye show sólo en QA para no tomar foco.

## Autorrevisión adversarial y límites

Se intentó refutar aceptación de state/código ambiguo, apertura antes de bind,
destino ajeno, nonce ignorado, retorno antes de cierre, resurrección A/B/A y
espera infinita al cancelar loadURL o shell. La fachada usa carrera con recepción
para retirar la espera y observar rechazos tardíos sin filtrar sus errores.
El cierre reclama una sola respuesta y destruye conexiones incompletas. La
suite SDK descubrió que la URL de canje agrega client-request-id: el transporte
ficticio admite únicamente esa clave, manteniendo origen/ruta exactos. El nonce
se pasa en AuthorizationCodeRequest conforme a tipos/código 7.1.1, sin reenviar
payload libre del callback como segundo argumento del SDK.

Se corrigieron fixtures tipados, compatibilidad ES2020 y manejo del ECONNRESET
esperado al cerrar el socket propio. No se amplió el baseline lint ni se omitió
un error para conseguir éxito. Esta es autorrevisión; falta revisión independiente
antes de archivar. No se presentan cuentas/consentimiento/Graph/caché Microsoft,
certificación de otros sistemas, firma o instalador como verificados.

Persisten scopes amplios, secreto Google distribuido y renovación Microsoft,
timeouts de SDK/servidor y posible petición ya iniciada al perder contexto.
La pestaña del navegador externo permanece bajo control del usuario. No hubo
commit, push, dispatch, SQL, .env, login real ni cambios al store del SO. No se
recalcula el índice global histórico de deuda técnica a partir de estos cambios.

Recuperación: mantener el SDK parcheado y proof/receiver vinculados al canje;
corregir registro/cliente mediante su contrato sin reabrir callback sin state
ni restituir el cliente confidencial sin credencial. Los cambios acumulados de
otras unidades y backups temporales se conservan para recuperación selectiva.

## Verificación final

`npm run verify:pr` completó trece etapas con exit 0: 5741 casos Vitest aprobados,
cinco omitidos; 502 archivos aprobados y dos omitidos (504 total), 193.27 s.
Además 22 pruebas del tooling y 33 contratos Python con standalone 3.12.11.
Lint incremental revisó 310 archivos sin deuda nueva y docs:check comprobó
enlaces de 717 Markdown activos. El baseline anterior tenía 5690 casos aprobados;
se agregaron 51 y no se retiraron los casos anteriores. Estas cifras corresponden
al worktree acumulado, no sólo a OAuth. [Recibo de compuerta](gate-summary.json).

`npm run app:smoke:build` aprobó en el sandbox Wad9Y3: 3451 fuentes copiadas y
seis artefactos no vacíos. Nueve fuentes relevantes copiadas coinciden con el
worktree por SHA256. Las 3470 fuentes de build/Python/workflows y la configuración
ESLint, junto con su inventario, permanecieron idénticas durante gate/build;
las modificaciones posteriores sólo registran evidencia y tareas/documentación.
[Recibo de build](build-summary.json), [fuentes](source-evidence.json) y
[hashes de logs](log-evidence.json). Se preservan los avisos del bundler sobre
chunks e inlineDynamicImports; aprobar build no acredita presupuesto de rendimiento.

La prueba OAuth nativa final volvió a aprobar ocho comprobaciones con el script
definitivo. Node local 26.7.0; CI usa 24 y no fue ejecutado aquí. El runtime
Electron sigue en 44.9.3, verificado por runtime:stable dentro de la compuerta.
La unidad permanece sin archivar hasta revisión independiente; macOS Intel
Python sigue pendiente en su unidad y no afecta el resultado de este intercambio.
