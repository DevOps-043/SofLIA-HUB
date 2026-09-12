# Verificación de fronteras del navegador — 2026-09-05

## Alcance

Continuación en `codex/upgrade-integrated-browser`, conservando los cambios
previos. No se realizó commit, merge, despliegue, migración remota ni cambio de
secretos. La implementación se mantiene en el worktree del navegador.

## Hallazgos corregidos

- Una revisión remota pendiente podía resolver la pestaña activa después de
  esperar. Ahora fija perfil/generación/ventana, revisión de foco, vista,
  documento y solicitud; también vuelve a ejecutar la guarda del agente antes
  de emitir `loadURL`. Se probaron cambios y recorridos de ida y vuelta.
- Un permiso remoto podía borrar advertencias locales. Se conserva la
  precedencia local, se ignora texto arbitrario remoto y se acota la respuesta
  a 4 KiB con plazo total, incluyendo un cuerpo atascado o fetch no cooperativo.
  Se excluyen perfiles efímeros, IPs literales y destinos locales conocidos;
  no hay redirecciones, credenciales de endpoint ni rutas/query en el payload.
- El bloqueo local no cubría todas las solicitudes sin flags. La guarda común
  incluye HTTP(S), marcos y redirecciones; también la restauración y popups.
  Descargas reanudadas/reintentadas revalidan política y los errores de E/S
  no publican rutas internas.
- Aceptar certificados válidos con `0` desactivaba Certificate Transparency.
  Ahora se usa `-3` para conservar Chromium y `-2` para rechazar inválidos.
- Las extensiones resolvían su registro mediante el perfil mutable tras E/S.
  Ahora fijan directorio y contexto, invalidan tokens y retiran cargas tardías
  o nuevas cargas cuyo registro no pudo guardarse. Cambiar de perfil descarga
  sus extensiones; las sesiones no persistentes se rechazan antes de cargar.
- Cerrar sesión conservaba el destino autenticado del selector. Ahora se
  revoca. El cambio manual requiere confirmación nativa (cancelar por omisión),
  una sola revisión pendiente y vigencia de cinco minutos. Cancelar no destruye
  pestañas y una respuesta tardía después de logout no cambia el perfil.

## Continuación de lifecycle e interfaz — 2026-09-06

La evidencia posterior y el estado actualizado están en
[limpieza efímera y avisos de navegación](verification-profile-cleanup-and-safety-ui-2026-09-06.md).
Corrección de la anotación preliminar: `commitShutdown()` no purga ni espera
una ventana viva; `beforeunload` todavía puede cancelar. La limpieza comienza
al cierre real y `will-quit` espera su barrera. Los resultados que siguen son
históricos de la auditoría del día 5, no la verificación final de esta continuación.

## Evidencia y verificación

Código y pruebas: `electron/integrated-browser/{safe-navigation,service,
download-manager,extension-manager}.ts`, sus suites bajo `electron/__tests__/`
y `BrowserRuntimeSupportPanel` en renderer. Los stores de prueba usan
directorios temporales propios, retirados por sus fixtures; no se probaron
mutaciones sobre perfiles reales del usuario.

Resultados finales:

- Regresión main/renderer: **59 archivos / 739 pruebas aprobadas**.
- `npm run typecheck`: aprobado para renderer y main.
- `npm run lint:changed`: 100 archivos sin deuda nueva.
- `npm run openspec:validate`: 26 cambios aprobados.
- `git diff --check`: aprobado.
- `npm run verify:pr`: no aprobado; pasa adaptadores (27), harness (25 rutas,
  9 skills), suministro, documentación de sistema (28 documentos, 150 IDs,
  410 canales, 422 archivos de prueba) y enlaces (266 Markdown), pero se
  detiene en `skills:seed:check`. Los archivos de semilla/registro no tienen
  diff frente a HEAD; es el desacuerdo preexistente de esta rama. No se regeneró
  SQL ni se modificó la base de datos para ocultar el fallo.

La suite completa sin filtro y el gate de release no se ejecutaron en esta
continuación. La regresión focalizada se ejecutó con:

```text
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --run --maxWorkers=1
```

Una ejecución intermedia tuvo 738/739 pruebas aprobadas: la prueba previa de
sync dividía el código base64url por guiones y podía comparar un solo carácter
contra todo el JSON. Se corrigió la extracción por el contrato completo de
43 caracteres y se verificó además la recuperación mediante `safeStorage`.
No se modificó el cifrado de producción; esta suite usa un doble del almacén
seguro, no constituye prueba del cifrado nativo del SO. La repetición final
aprobó las 739 pruebas. Vite conserva un aviso de compatibilidad futura del
cargador de configuración; no se silenció ni afectó el resultado.

## Revisión adversarial y límites

Se intentó refutar aislamiento con respuestas tardías, perfiles A→B→A, cambios
de foco/documento, navegación más reciente y cancelación del agente. También
se probaron cuerpos excesivos/inválidos, fetch que ignora abort, protocolos,
configuración con credenciales, revocación de descargas, token reutilizado,
extensión cargada tras logout, error de rename y habilitación/eliminación
concurrentes. Ningún texto de proveedor se trata como instrucción o mensaje
confiable. No se añadieron canales IPC ni permisos runtime.

En la auditoría inicial se reabrieron 5.4 y 5.5: los avisos sólo estaban en logs.
La continuación del día 6 añade avisos en la barra y cierra 5.4; el intersticial
y las rutas restantes siguen en 5.5. El
proveedor remoto cubre navegación explícita, no todas las redirecciones o
descargas. No hay lista global contra malware ni detección DNS de intranets
con nombre público. Los permisos por sitio de extensiones y su catálogo
firmado continúan pendientes. La integridad se verifica al importar, no en
cada reinicio; el catálogo y migración de registros requieren trabajo adicional.

El progreso vigente se mantiene en `../tasks.md` y en el reporte de continuación;
4.1 se cierra tras verificar cancelación, barreras y espera nativa de salida.

Una operación nativa ya emitida no se puede deshacer retroactivamente; una
extensión que termine de cargar tras invalidación se descarga inmediatamente,
pero no se promete que Chromium no haya ejecutado su inicialización. Un rename
ya recibido por el SO sólo puede afectar el directorio original fijado.
No hay coordinación entre varios procesos sobre los registros de extensiones.

El runtime compartido instalado sigue siendo beta; no se modificó. La prueba
nativa completa del producto sobre Electron estable, incluido instalador, sigue
pendiente. No se presenta esta entrega como apta para release.

## Referencias verificadas

- [Electron: verificación de certificados](https://www.electronjs.org/docs/latest/api/session#sessetcertificateverifyprocproc).
- [Electron: soporte y límites de extensiones](https://www.electronjs.org/docs/latest/api/extensions).

## Reversión

Mantener `BROWSER_PROFILES_ENABLED` apagado evita exponer perfiles experimentales.
Retirar la configuración de reputación remota conserva la protección local;
no se añadieron proveedores ni configuración real. Los registros de extensiones
mantienen versión 1: no se requiere migración para estas guardas. Descartar sólo
estos hunks mediante revisión preservaría el trabajo previo del worktree.
