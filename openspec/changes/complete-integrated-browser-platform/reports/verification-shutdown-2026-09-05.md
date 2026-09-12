# Barrera de guardado antes de salir o instalar

Estado: implementación focalizada verificada; PR bloqueado por semilla SQL
preexistente y smoke nativo parcial. No es release.
Fecha: 2026-09-05. Rama: `codex/upgrade-integrated-browser`.
Se conserva la [evidencia anterior](verification-2026-09-05.md). El checkout
original de organizaciones/WhatsApp no se modificó.

## Resultado

- `before-quit` espera la sesión y vuelve a autorizar una sola salida; no detiene
  anticipadamente los servicios del lifecycle. El servidor de workspaces también
  pasa su detención a `will-quit` para sobrevivir a una cancelación.
- `ShutdownGuard` comparte la protección con el instalador. A los cinco segundos
  o ante un error pregunta reintentar/cancelar/salir sin guardar; cancelar es el
  default. Reintentar un timeout no crea otra E/S concurrente. La aprobación
  tardía de un intento cancelado no cierra la aplicación.
- La barrera espera guardados de una ventana ya cerrada, permite reintentar su
  último snapshot del mismo perfil y captura cambios de pestañas llegados durante
  E/S. Un cambio de perfil o cancelación invalida el intento. La aprobación evita
  otro autosave/guardado al desmontar y permite cerrar ventanas separadas.
- La instalación exige descarga lista y guard configurado. Se agrupan solicitudes
  repetidas. Errores del instalador devuelven el control; no se confunde iniciar
  el instalador con completar la actualización.
- El IPC de instalación verifica ventana y frame principal, espera el resultado
  y sanea el error. Preload conserva el único canal permitido; wrapper y tres
  superficies renderer muestran el rechazo/cancelación.
- Una cancelación anterior al primer microtask tampoco inicia la preparación.
- El smoke nativo detectó zoom compartido por origen en Electron 43. Se corrigió
  estado, incremento y duplicación para usar el zoom real, no metadata antigua.
  El aislamiento por pestaña se reabre como pendiente 2.5.

## Evidencia

Prueba focalizada intermedia: 9 archivos / 141 pruebas aprobadas.
Suite ampliada (con regresión del navegador y workspaces):

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service
```

Resultado final: **49 archivos / 505 pruebas aprobadas**, 16,95 segundos,
inicio 10:58:33 local. Incluye regresiones de cancelación antes del microtask y
zoom nativo compartido; no es la suite completa del repositorio.

| Comando | Resultado observado |
|---|---|
| `npm run typecheck` | Aprobado: ambos proyectos TypeScript |
| `npm run lint:changed` | Aprobado: 79 archivos sin deuda nueva |
| `npm run openspec:validate` | 26 cambios aprobados |
| `npm run verify:pr` | Falló en `skills:seed:check`; no llegó a las etapas posteriores |
| Etapas previas del gate | Adaptadores 27; arnés 25 rutas/9 skills; suministro 11 vetos/18 hooks; documentación 28 documentos/150 IDs/404 canales/416 pruebas; enlaces 254 Markdown aprobados |
| `node --check` sobre runner y harness nativos | Aprobado |
| `git diff HEAD --check` | Sin errores; sólo avisos de conversión LF/CRLF |

El inventario se actualizó a 416 archivos: 292 main, 123 renderer y 1 script.
La divergencia de `database/lia/migrations/system-skills-catalog.sql` frente a
`src/shared/skills/registry.ts` continúa fuera del diff; se comprobó también que
`scripts/quality/system-skills-seed.mjs` no cambió. No se regeneró SQL para ocultar
el bloqueo. No se ejecutó `verify:release`.

## Electron nativo aislado

Se añadió `npm run browser:smoke:native` (opt-in Windows), con descarga oficial
opcional, SHA-256 obligatorio, perfil temporal nuevo, ventanas ocultas y páginas
HTTP locales. Transpila siete módulos reales; no carga bootstrap ni `.env`, no
instala dependencias ni usa cuentas. La operación y los códigos de salida están
en [release y recuperación](../../../../docs/operations/release-and-recovery.md#smoke-nativo-aislado-del-navegador-windows).

```powershell
node scripts/quality/smoke-browser-native.mjs --download-runtime
# Repetición con el binario extraído de la primera ejecución:
npm run browser:smoke:native -- --electron <ruta-absoluta-a-electron.exe>
```

Artefacto: `electron-v43.4.0-win32-x64.zip`, 144408141 bytes.
SHA-256 comprobado contra `SHASUMS256.txt` oficial:
`ef0709cfa719739acce73de6f9b684304baf38c6454376638a70d34a7cecffe0`.
El proceso reportó Electron **43.4.0**, Chromium **150.0.7871.224** y Node
**24.18.1**, coincidentes con la [publicación oficial](https://releases.electronjs.org/release/v43.4.0).

Dos procesos reales: 9 comprobaciones de ejercicio y 3 de recuperación:

- Navegación en dos WebContentsView sandboxed, división y traslado a otra ventana.
- Búsqueda con dos coincidencias, zoom/reset y silencio independiente.
- PDF real (cabecera `%PDF-`) y dos descargas homónimas sin sobrescribir.
- Escritura SQLite/FTS y lectura desde el segundo proceso.
- Sesión/respaldo en disco, corrupción controlada y recuperación de metadata.
- `before-quit`/`will-quit` reales, escritura esperada y aprobación única en
  ambos procesos usando el `ShutdownGuard` del producto.

Resultado **parcial**: 12 comprobaciones positivas, una limitación detectada.
La segunda pestaña del mismo origen cambia de zoom con la primera. La
[documentación de Electron](https://www.electronjs.org/docs/latest/api/web-contents#contentssetzoommodemode)
describe el comportamiento por origen y sitúa `setZoomMode('isolated')` en
Electron 44; no se invoca una API ausente en 43 ni se vuelve a una beta para
ocultar el problema. El runner se ajustó para devolver código 2 ante limitaciones;
la repetición mediante npm terminó como fallo (npm reportó código 1), con las
12 comprobaciones y el aviso explícito. No se presenta como gate verde.

Se preservaron artefactos sólo de prueba en los directorios del temporal del SO
`pulse-browser-smoke-2XqWst` (incluye runtime y ZIP) y
`pulse-browser-smoke-Kz3HgV` (repetición) y `pulse-browser-smoke-1E0yAa`
(repetición final), con PDF, descargas, perfiles y reportes
`exercise.json`/`restore.json`. Los procesos finalizaron. Una prueba negativa
adicional con el ejecutable beta instalado fue rechazada con código 1 antes de
abrir ventanas o crear perfiles: `pulse-browser-smoke-s38J09` conserva sólo los
módulos transpilados. No se eliminó estado del usuario ni se modificó el Electron
44 beta de `node_modules` compartido.

## Revisión adversarial

| Hipótesis | Resultado |
|---|---|
| Cerrar con una escritura viva termina antes del rename | Promesa diferida bloquea salida; prueba espera incluso tras desmontar ventana |
| Cancelar o cerrar el diálogo autoriza pérdida de datos | Default/cancel ID = 1; ningún proceed tras cancelar o fallar el diálogo |
| Reintentar causa varias escrituras o instaladores | Timeout reusa E/S, duplicados comparten promesa y quit consume una autorización |
| Cancelar durante carga inicia después un guardado tardío | Revisión de cierre invalida el intento antes de escribir |
| Cancelar antes de que prepare empiece aún lanza E/S | Se revalida generación dentro del microtask; prueba negativa aprobada |
| Se pierde un cambio de pestaña durante la E/S | Comparación de metadata obliga a guardar el snapshot actualizado |
| Ventana separada impide salir porque se reintegra | Sólo con cierre aprobado deja pasar close; cancelar conserva comportamiento normal |
| Fallo de instalador deja la aplicación marcada para salir | Error emitido o lanzado restablece control y permite nuevo intento |
| Un subframe dispara el instalador | Handler rechaza otro WebContents, frame ajeno y frame nulo |
| El renderer informa éxito ante `{ success: false }` | Wrapper rechaza y hooks conservan error visible; preload probado directamente |
| Un servicio que falla al detenerse impide liberar los demás | Pasos independientes con errores saneados y prueba negativa |
| Un mock confirma aislamiento de zoom inexistente en Chromium | Smoke real detecta propagación; 2.5 reabierto y estado basado en `getZoomFactor` |
| El smoke usa cuentas o sobrescribe datos reales | userData/sessionData/descargas nuevos, contenido loopback, sin bootstrap; sólo se corrompe la sesión generada |

Hallazgo abierto **P2**: aislamiento de zoom incompleto en 2.5. No hay aprobación
de esa tarea basándose sólo en los mocks. Las rutas de cierre/cancelación,
instalación duplicada, frame no autorizado y estado renderer se corrigieron y
quedaron cubiertas por regresión; no se extrapolan a todos los subsistemas.

## Reversión del bloque

No cambia esquemas remotos ni activa la restauración por defecto. Para revertir
la integración de cierre hay que tratar lifecycle, guard de instalación y
consumidores renderer como una unidad: quitar sólo el guard deja la instalación
rechazada por diseño. Conservar archivos de sesión/respaldo; no borrarlos para
volver al código anterior. Desactivar el flag de sesión evita consumir/guardar
la sesión, pero no elimina la validación del instalador. El smoke y sus
temporales son independientes del runtime instalado y no requieren rollback de
dependencias. El cambio sigue sin commit, merge ni publicación.

## Alcance y riesgo residual

Se cierra el pendiente de barrera señalado en el reporte anterior, dentro de
3.3. El plan global queda en **28/64** al reabrir 2.5 con evidencia nativa;
no se marcan terminadas las fases aún abiertas.
La sesión restaurable continúa desactivada por defecto y las funciones nuevas
siguen aisladas en el worktree, sin despliegue ni merge.

Se ejecutó Electron nativo focalizado, no la aplicación completa, el instalador
real, reinicio del sistema ni corte eléctrico. El smoke de sesión verifica
store/guard reales, no la restauración de vistas por IntegratedBrowserService,
el IPC de producción ni los diálogos HITL. La barrera protege sesiones del
navegador, no promete drenar todos los
stores o terminar sidecars asíncronos antes de que el SO cierre el proceso.
Según la [documentación de Electron](https://www.electronjs.org/docs/latest/api/app#event-before-quit),
Windows no entrega estos eventos en apagado/reinicio/logout, y el actualizador
nativo puede cerrar ventanas antes de `before-quit`; por eso se protege también
la llamada explícita al instalador. Se inspeccionó la implementación local de
`electron-updater/out/BaseUpdater.js`, que inicia la instalación antes de
solicitar el quit en Windows. No se extrapola esa inspección a un smoke real.

Se descargó y extrajo un runtime de prueba; no hubo instalación del producto,
descarga de actualizaciones del producto, migración remota, envío de mensajes,
lectura de secretos, commit ni PR. SQL de la semilla Lia sigue fuera del diff
de esta continuación.
