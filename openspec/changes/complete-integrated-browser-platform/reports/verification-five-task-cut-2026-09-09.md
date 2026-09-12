# Corte de cinco tareas del navegador

Fecha: 2026-09-09. Worktree `upgrade-integrated-browser`, rama
`codex/upgrade-integrated-browser`. Implementación local; no despliegue, commit,
SQL remoto ni cambios de secretos. Se preservaron cambios ajenos del worktree.

## Resultado y alcance

Se cierran cinco tareas reales: **5.5, 6.6, 7.3, 7.6 y 8.5**.
El cambio pasa de 46/64 a **51/64**, con **13 tareas abiertas**.
5.5 y 7.3/7.6 incorporan implementación de cortes anteriores, validada e integrada
en éste; no se presentan todas sus líneas como nuevas de hoy.

- **5.5:** revisión remota de solicitudes gobernadas e intersticial main aislado,
  incluyendo marcos, ventanas hijas, descargas y certificados sin bypass.
  Se amplió el smoke con iframe, ventana hija y TLS real autofirmado.
- **6.6:** nueva bitácora SQLite cifrada por perfil, traza de operaciones y
  política, consulta paginada, retención y borrado nativo HITL en cuatro capas.
  No registra secretos, contenido, argumentos ni capturas. Un resultado de
  operación no equivale a éxito del objetivo del usuario.
- **7.3:** cliente y adaptadores locales conectados, checkpoints, primera base,
  conflictos/CAS y aplicación revisada. Nueva integración con transporte HTTP
  real contra fixture local, dos perfiles, reapertura sin eco y revocación.
- **7.6:** controles de categorías, ejecución, pausa, estado, archivos de clave y
  revisión inicial/conflictos. El renderer no recibe códigos, claves ni rutas.
- **8.5:** instalación local de Electron 43.4.0 y corrección de compatibilidad del
  portapapeles. La compuerta contrasta manifiesto, lockfile, paquete y ejecutable;
  no basta declarar estable en package.json.

La documentación canónica y los contratos viven en
[arquitectura](../../../../docs/architecture/integrated-browser-platform.md),
[IPC](../../../../docs/architecture/ipc-and-integrations.md) y
[diseño](../design.md). Se actualizaron al final de la implementación.

## Evidencia ejecutada

- `npm ci --ignore-scripts --no-audit --no-fund`: 1.321 paquetes, exit 0.
  Después de inspeccionar el instalador: `node node_modules/electron/install.js`,
  exit 0. No se ejecutaron automáticamente los demás hooks nativos; esto no
  acredita todas las dependencias del producto empaquetado.
- `node scripts/quality/check-electron-stability.test.mjs` y
  `npm run runtime:stable`: exit 0; binario instalado **43.4.0**.
- Regresión dirigida: 76 archivos, **1.023 pruebas aprobadas** antes de las tres
  pruebas adversariales adicionales. Éstas pasaron junto con todo el archivo
  de bitácora (14 pruebas). Resultado consolidado final al pie.
- `npm run typecheck`: exit 0. `npm run lint:changed`: 191 archivos sin deuda
  nueva en la primera pasada; se repite tras la revisión adversarial.
- `npx openspec validate complete-integrated-browser-platform --strict`: exit 0.
- `npm run verify:pr`: adapters (27), harness (25 rutas/9 skills), supply-chain,
  docs:system (28 documentos, 150 IDs, **419 canales y 441 archivos de prueba**)
  y docs:check aprobados. Se detiene en `skills:seed:check`: discrepancia previa
  entre `database/lia/migrations/system-skills-catalog.sql` y
  `src/shared/skills/registry.ts`, no modificados en este corte. No es PR verde.

Regresión reproducible:

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel BrowserNavigationSafetyNotice BrowserSyncPanel BrowserSyncControls BrowserAgentAuditPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --run --maxWorkers=1
```

Smoke reproducible, desde este worktree, con ruta absoluta a su Electron:

```powershell
node scripts/quality/smoke-browser-native.mjs --safety-only --electron "C:/Users/fysg5/Desktop/SofLIA/Pulse Hub/SofLIA-HUB/.worktrees/upgrade-integrated-browser/node_modules/electron/dist/electron.exe"
node scripts/quality/smoke-browser-native.mjs --vault-only --electron "C:/Users/fysg5/Desktop/SofLIA/Pulse Hub/SofLIA-HUB/.worktrees/upgrade-integrated-browser/node_modules/electron/dist/electron.exe"
```

- Safety: **12 comprobaciones**, exit 0; fixture temporal `pulse-browser-smoke-uVYGaW`.
  HTTP/HTTPS loopback y claves autofirmadas sólo dentro del sandbox de prueba;
  OpenSSL de Git for Windows, sin modificar certificados de confianza del SO.
- Vault/audit: **10 comprobaciones**, exit 0; `pulse-browser-smoke-AU6xQE`.
  DPAPI real, recuperación exclusiva con principal ausente, integridad, ámbito,
  reapertura, bitácora y borrado.
- Smoke completo anterior del mismo corte: 44 comprobaciones internas aprobadas
  en seis fases, `pulse-browser-smoke-MIUopU`; **runner exit 2** por propagación
  de zoom entre pestañas del mismo origen en Electron 43. La tarea 2.5 permanece
  abierta. No se anuncia ese comando como aprobado.

## Revisión adversarial

Se intentaron refutar: separación de perfiles, ausencia de secretos en disco/IPC,
aceptación de un borrado después de perder el control humano, doble confirmación,
expiración de cinco minutos, recreación de perfil cerrado tras una operación,
reutilización de trazas, escritura con flag apagado y continuación sin poder
registrar el inicio. Las pruebas negativas cubren estos casos, junto con
ciphertext corrupto, versión futura, quota de página y disponibilidad del cifrado.

La matriz detectó y corrigió incompatibilidad de tipo de portapapeles al usar
Electron estable, expectativa antigua del número de canales y un aviso de lint
del cleanup React. La bitácora abre/cierra SQLite por operación, sin cola que
pueda escribir después de purgar. No concede lectura/escritura al agente runtime.

## Condiciones de producción y pendientes

No se ejecutó el producto completo ni su instalador. El fixture de sync usa
transporte real contra servidor local de prueba: **no verifica Lia Auth/RLS
reales ni dos equipos físicos**. La migración remota y esas pruebas requieren
un rollout autorizado. Flags avanzados permanecen apagados por defecto.
Cancelar no deshace commits remotos y DPAPI no aísla de otros procesos del mismo
usuario. La bitácora no conserva capturas ni prueba el éxito semántico de tareas.
La suite global no está acreditada; las cifras anteriores son de regresión dirigida.

Trece tareas restantes, sin subdividir para inflar avances:

- 2.5: zoom realmente aislado.
- 4.8: autenticación del SO, bloqueo/autobloqueo y formularios avanzados.
- 4.10: passkeys.
- 5.6 y 5.7: permisos por sitio y catálogo de extensiones verificado.
- 6.3: fuentes múltiples, selector de pestañas y citas.
- 6.4 y 6.5: pausa/detención/toma de control end-to-end y handoff sensible.
- 6.7, 6.8 y 6.9: atajos agénticos, índice semántico y voz Orbe integrada.
- 8.7: recuperación de bóveda corrupta y migraciones/rollback de otros stores.
- 9.5: smoke completo Windows/instalador y validaciones reales de rollout.

Rollback operativo: desactivar flags avanzados y reiniciar sin borrar datos;
conservar archivos cifrados y checkpoints. La versión antigua no debe rebajar ni
sobrescribir formatos nuevos. No ejecutar SQL de rollback remoto sin autorización.

## Consolidación final

La última regresión pasó **1.026 pruebas en 76 archivos** (68,98 s), incluidas
las nuevas negativas. Typecheck y lint incremental de 191 archivos pasaron de
nuevo. Diff check del alcance y validaciones documentales pasaron. El bloqueo
de `skills:seed:check` permanece explícito y no se declara release ni PR aprobado.
