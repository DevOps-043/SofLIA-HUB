# Guardado manual y actualización de credenciales

Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Alcance parcial de 4.8; no es release, despliegue ni autenticación del SO.

## Implementación

El gestor muestra el origen determinado en main y permite seleccionar una
cuenta para actualizar con el secreto anterior oculto. Una cuenta existente
requiere revisión nativa del reemplazo, con cancelación predeterminada. La
revisión cifra antes de esperar confirmación, vence en cinco minutos y se
consume una sola vez; el commit verifica contexto y revisión de la bóveda.
Guardar no puede crear silenciosamente otra cuenta a partir de un ID eliminado
o ajeno, ni renombrar sobre una cuenta existente. Cancelar no escribe.

Las operaciones se serializan por archivo entre instancias del proceso; el
archivo anterior permanece ante fallo de reemplazo. Lecturas acotadas a 12 MiB
rechazan corrupción y duplicados sin registrar fragmentos de JSON. Se corrigió
el límite del cifrado base64 para aceptar contraseñas Unicode de 4.096 unidades
UTF-16. No se cambió la versión 1 del archivo ni se migraron datos del usuario.

Servicio, handlers, preload y wrapper conservan los cinco canales. Main exige
frame principal autenticado, rechaza payload abierto, origen obsoleto y control
del agente. Sólo la contraseña escrita por el usuario viaja hacia main; ninguna
contraseña almacenada se devuelve. La UI maneja reintento, cancelación, fallo
del puente y limpieza del campo, sin anunciar éxito si falta metadata.

## Verificación

Comandos ejecutados:

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --maxWorkers=1
npm run typecheck
npm run lint:changed
npm run verify:pr
npm run openspec:validate
git diff --check
```

Resultados: **56 archivos / 662 pruebas aprobadas**; TypeScript aprobado;
lint incremental aprobado en 91 archivos; OpenSpec estricto: 26 cambios
aprobados. Diff sin errores de espacios (Git avisa conversión LF/CRLF).

`verify:pr` aprobó 27 adaptadores, arnés (25 rutas/9 skills), cadena de suministro
(11 versiones vetadas ausentes/18 ganchos), documentación de sistema
(28 documentos/150 IDs/405 canales/419 archivos de prueba) y enlaces
(258 archivos Markdown). Se detuvo en `skills:seed:check`: discrepancia previa
entre `database/lia/migrations/system-skills-catalog.sql` y el registro. El diff
contra HEAD de esa semilla, `src/shared/skills/registry.ts` y
`scripts/quality/system-skills-seed.mjs` está vacío. No se regeneró SQL ni se
ejecutó `verify:release`; no se presenta la compuerta global como aprobada.

## Revisión adversarial y límites

Se intentó refutar: no escribir antes de confirmar; no sustituir otra cuenta;
no perder escrituras concurrentes; no aceptar revisión usada o vencida; no
guardar en otra pestaña tras aprobar tarde; no leer durante control del agente;
no exponer rutas/secretos por errores; no anunciar éxito al cancelar o fallar.
Las pruebas usan disco temporal y Electron simulado. No se ha probado este
flujo de contraseñas en el producto empaquetado ni contra cuentas reales.

No hay bloqueo multiproceso ni respaldo de la bóveda. Una operación de archivo
ya entregada al SO no se puede revocar: puede completarse en el perfil original
y su respuesta descartarse si el contexto cambió después del `rename`. El
relleno tampoco deshace texto que Chromium ya recibió. La revisión de contexto
no detecta todas las mutaciones DOM autónomas de una SPA.

El lector ampliado mantiene versión 1 y acepta archivos anteriores, pero volver
a un lector con límite de 16 KiB puede rechazar entradas Unicode nuevas. El
rollback debe conservar la corrección de lectura; no truncar ni borrar
credenciales para forzar compatibilidad.

Permanecen abiertos aviso automático tras login, autenticación del SO antes de
operaciones sensibles y passkeys. La importación/exportación JSON se implementó
por separado con revisión nativa, destino explícito y conteos sin secretos; no
se debe confundir esa advertencia con autenticación biométrica. No se puede presentar
el diálogo de reemplazo como biometría: Electron sólo ofrece
[Touch ID en macOS](https://www.electronjs.org/docs/latest/api/system-preferences).
La verificación de Windows para aplicaciones de escritorio requiere integración
nativa con HWND y manejo de disponibilidad/cancelación según
[UserConsentVerifierInterop de Microsoft](https://learn.microsoft.com/en-us/windows/win32/api/userconsentverifierinterop/nf-userconsentverifierinterop-iuserconsentverifierinterop-requestverificationforwindowasync),
que aún no existe en este proyecto. 4.8 permanece sin marcar; el total del cambio
continúa en 30/64 tareas completas.
