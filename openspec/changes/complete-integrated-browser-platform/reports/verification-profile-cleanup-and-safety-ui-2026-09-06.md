# Limpieza efímera y avisos de navegación — 2026-09-06

## Alcance y resultado

Continuación de `complete-integrated-browser-platform` en el worktree
`upgrade-integrated-browser`, rama `codex/upgrade-integrated-browser`. Se
preservan los cambios previos; no se hizo commit, merge, despliegue, migración
remota ni modificación de secretos o dependencias compartidas.

Se completan 4.1 (lifecycle de perfiles) y 5.4 (contrato y avisos de navegación).
El avance queda en **43/64 tareas cerradas y 21 abiertas**, no en paridad total
con navegadores comerciales ni en estado apto para release.

## Correcciones

- Purga del perfil saliente tras cerrar realmente o cambiar de perfil, no al
  aprobar una salida que todavía puede cancelar `beforeunload`.
- Barreras de todos los stores, incluidas lecturas que podían reabrir SQLite
  o repoblar cachés. Las escrituras de privacidad entran en su cola antes de
  esperar la carga inicial. Se esperan todas las operaciones aunque una falle.
- Reapertura y salida normal esperan la misma limpieza. Se invalidan cachés y
  snapshots de sesión para no recrear los datos borrados. Permisos tardíos del
  sistema operativo no escriben sobre el nuevo perfil.
- `will-quit` se cancela temporalmente: Electron no espera las promesas de sus
  listeners. Al completar la limpieza se reanuda una sola salida; un fallo
  permite reintentar, volver a la aplicación o salir incompleto con HITL nativo.
- Avisos por pestaña en la barra para advertencia, último intento bloqueado y
  proveedor no disponible. Un fallo remoto no declara el sitio seguro ni lo
  clasifica como peligroso por sí solo. Se conserva una advertencia local.
- `tabs[].navigationSafety` amplía el estado existente sin canales nuevos,
  sin permisos adicionales ni texto arbitrario del proveedor. No se persiste
  reputación ni se exponen URLs adicionales; los tipos mantienen compatibilidad
  con versiones anteriores del proceso main.
- Las respuestas obsoletas no publican avisos; enlaces, redirecciones y cambios
  de documento reemplazan el dictamen anterior por revisión local. Las ventanas
  nativas separadas/popups aún requieren su propia superficie de aviso (5.5).

La implementación está en `electron/integrated-browser/`,
`electron/main/app-lifecycle.ts` y `src/components/browser/`. La decisión duradera
se documenta en [arquitectura](../../../../docs/architecture/integrated-browser-platform.md),
[contrato IPC](../../../../docs/architecture/ipc-and-integrations.md) y los
escenarios de `../specs/browser-profile-data/` y `../specs/browser-privacy-protection/`.

## Evidencia automatizada

- Pruebas dirigidas de servicio, contrato y UI: **6 archivos / 212 pruebas**.
- Regresión ampliada main/renderer: **60 archivos / 759 pruebas aprobadas**.
- `npm run typecheck`: aprobado en renderer y main.
- `npm run lint:changed`: **102 archivos**, sin deuda nueva.
- `npm run openspec:validate`: **26 cambios aprobados**.
- `git diff --check`: aprobado.
- `npm run verify:pr`: no aprobado. Pasan adaptadores (27), harness (25 rutas,
  9 skills), suministro, documentación de sistema (28 documentos, 150 IDs,
  410 canales, 423 archivos de prueba) y enlaces (267 Markdown). Se detiene en
  `skills:seed:check`; semilla SQL y registro no tienen cambios frente a HEAD.

La primera repetición del gate detectó el inventario documental pendiente de
actualizar por la nueva suite renderer; se corrigió a 423 archivos y el gate
repitió hasta el fallo preexistente de semilla. No se ejecutaron en esta fase
la suite completa sin filtro ni la compuerta de release.

Comando de regresión ampliada:

```text
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel BrowserNavigationSafetyNotice IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --run --maxWorkers=1
```

Las fixtures usan disco temporal propio, no perfiles del usuario. Se verifican
rename retenido, lectura inicial pendiente, cierre cancelado, reapertura,
fallo de caché, reintento, conservación de un perfil autenticado hermano y
permiso del SO que termina después de cambiar de perfil. La UI se verifica
con React/jsdom; no constituye prueba visual del producto empaquetado.

Una ejecución intermedia detectó un campo agregado al tipo incorrecto y un
doble `getURL` que conservaba una URL anterior durante `loadURL`; se corrigieron
ambos y se repitieron las pruebas. No se relajaron las guardas de producción
para aceptar un dictamen remoto sobre un documento diferente.

## Evidencia con Electron estable real

Se ejecutó `browser:smoke:native -- --lifecycle-only --electron RUTA_ABSOLUTA`
usando Electron **43.4.0**, Chromium **150.0.7871.224**, Node **24.18.1**.
Resultado: **3 comprobaciones aprobadas, código 0**:

1. Cancelar `beforeunload` conserva ventana, cookie y marcadores.
2. `will-quit` mantiene el proceso vivo mientras se retiene la limpieza.
3. La salida final ocurre una sola vez después de retirar cookies y temporales.

Evidencia local conservada:
`C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-gAf4wi/lifecycle.json`.
El runtime ya disponible se había descargado del origen oficial y verificado
por SHA-256; no se sustituyó el Electron beta de las dependencias compartidas.

El harness `test/manual/browser-native/lifecycle.cjs` ejecuta el coordinador
real de lifecycle, un store de marcadores real, ventana y cookies nativas.
La función de limpieza es una fixture con barrera, no el servicio integrado
completo; este último tiene regresión independiente. No arranca agentes,
sidecars ni el instalador. Una primera ejecución devolvía una función desde
`executeJavaScript`, valor no serializable; la fixture se corrigió a `void 0`
y la repetición aprobó. No demuestra actualización instalada ni cierre forzado.

El contrato de eventos se contrastó con [before-quit](https://www.electronjs.org/docs/latest/api/app#event-before-quit)
y [will-quit](https://www.electronjs.org/docs/latest/api/app#event-will-quit) de Electron.
La barrera nativa verifica el orden real, no sólo un emisor simulado.

## Revisión adversarial

Se intentó refutar el aislamiento mediante escrituras posteriores al cierre,
reapertura antes de terminar, cambio de perfil antes de resolver permisos,
fallos parciales y cancelación después de aprobar salida. Se corrigieron la
purga prematura, el drenaje del perfil entrante y la resurrección por cachés.

Se intentó publicar un dictamen tardío después de cambiar pestaña, perfil,
documento, ventana, tarea del agente o solicitud, incluso con ida y vuelta.
Se verificó que no altera navegación ni avisos. El renderer usa texto escapado,
no HTML del proveedor, y no contiene un botón para saltarse bloqueos.

No se promete borrado físico irrecuperable, limpieza tras matar el proceso o
apagado del sistema, ni eliminación de archivos descargados. Reputación remota
fuera de navegación explícita, intersticiales, avisos en ventanas nativas,
passkeys/Windows Hello, sync remoto, gobierno avanzado del agente, permisos por
sitio de extensiones y el smoke integral siguen pendientes en `../tasks.md`.

## Reversión y entrega

Mantener `BROWSER_PROFILES_ENABLED` apagado conserva el rollout controlado.
Retirar la configuración del proveedor desactiva sólo la consulta remota; la
protección local permanece. La UI tolera estados anteriores sin el nuevo campo.
No cambió el esquema persistente y no se requiere migración. Para revertir,
revisar únicamente estos hunks, sin descartar el resto del worktree.

La compuerta global sigue separada de las pruebas focalizadas: la discrepancia
preexistente de `skills:seed:check` entre el catálogo SQL y el registro de skills
no se corrige regenerando SQL ajeno a esta fase. No se declara release aprobada.
