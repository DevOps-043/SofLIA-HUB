# Verificación: bóveda, guardado sugerido y esquema de sync

Trabajo iniciado el 2026-09-06 y continuado el 2026-09-07. Rama
`codex/upgrade-integrated-browser`, worktree `upgrade-integrated-browser`;
se preservaron cambios previos. No hubo commit, PR, aplicación SQL remota,
lectura/modificación de secretos ni instalación de dependencias en el producto.

## Resultado y referencia

El [contexto de Proton Pass](context-password-manager-proton-pass-2026-09-06.md)
documenta investigación oficial y brechas. Se adoptaron dos principios de su
[modelo de seguridad](https://proton.me/blog/proton-pass-security-model) y
[guardado](https://proton.me/support/proton-pass-autosave): cifrar también metadata
y pedir consentimiento antes de guardar una cuenta detectada. No se copió su
código ni se reprodujo su jerarquía de claves/E2EE compartible.

- Bóveda local v2: AES-256-GCM con clave/nonce nuevos por instantánea, clave
  protegida por safeStorage, AAD de versión/ámbito; usuario, origen y fechas ya
  no quedan legibles en JSON. En Windows se verificó DPAPI real. Su
  [frontera del SO](https://www.electronjs.org/docs/latest/api/safe-storage) no
  protege frente a procesos del mismo usuario ni autentica su presencia.
- Migración v1→v2 por cola, IDs/fechas conservados, respaldo también cifrado,
  rechazo de corrupción/versiones futuras sin restauración silenciosa. Borrar
  elimina la cuenta del principal y del respaldo; no implica borrado físico.
- Guardado sugerido opt-in por perfil: lectura al submit tras clic/Enter
  confiable, sólo marco principal y acción del mismo origen. Puente CDP privado
  con mundo aislado propio, no consola ni canal de secretos en renderer/agente.
  Candidato preparado cifrado antes de esperar/confirmar; no presume login
  exitoso. Repetir una contraseña idéntica no interrumpe. Cancelar no guarda.
- Preferencia cerrada en servicio, handler, allowlist, preload y wrapper;
  UI desactivada por defecto, explica límites y respeta cancelación/error.
- Tarea 7.1: migración Lia aditiva de dispositivos, envelopes y recibos.
  Propietario derivado de Auth Lia; sesión firmada verificada contra
  `auth.sessions`, RLS y RPC cerradas, revisión base e idempotencia. Se usa el
  [contrato de sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions),
  no metadata editable ni una política permisiva para anon. También se excluye
  [Auth anónimo](https://supabase.com/docs/guides/auth/auth-anonymous), que usa
  el rol authenticated; se exige `is_anonymous: false` firmado. No hay cliente
  remoto conectado, claves en servidor ni sincronización de contraseñas.

## Matriz y pruebas

| Frontera | Casos verificados | Evidencia |
|---|---|---|
| Bóveda | Metadata oculta; tampering; ámbito distinto; versión futura; rename fallido; colas/cambio de perfil; borrado del respaldo | Vitest y DPAPI real |
| Observador | Mundo privado, marco principal, payload cerrado, sintéticos rechazados, navegación, reconexión CDP y desmontaje | Vitest y Chromium real |
| Consentimiento | Cuenta nueva/reemplazo, cancelación, cuenta idéntica, cambio de pestaña/control/origen/consentimiento, preferencia cargada tarde | Servicio, saver, UI, handler y preload |
| Sync SQL | Aplicación doble; anon/sesión ajena; SELECT propio; INSERT/UPDATE/DELETE directos denegados; CAS/replay; revocación; logout; cuotas; rollback | PostgreSQL 18.3 en PGlite 0.5.8 |

Regresión ampliada: **62 archivos / 799 pruebas aprobadas** (baseline anterior:
60 / 759). Comando:

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel BrowserNavigationSafetyNotice IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --run --maxWorkers=1
```

Typecheck aprobado. La compuerta `verify:pr` continúa fallando en la discrepancia
preexistente de `skills:seed:check`, entre el catálogo SQL y el registro de skills;
ninguno fue modificado. Pasaron adapters, harness, supply-chain, docs:system y
docs:check antes de esa parada. No se ejecutó `verify:release` ni se declara
aprobada la suite global que la compuerta no alcanzó.

### Electron nativo

Runtime oficial aislado Electron 43.4.0 (SHA-256 verificado en la fase anterior),
Chromium 150.0.7871.224, Node 24.18.1. Nuevas fases:

```powershell
npm run browser:smoke:native -- --vault-only --electron "C:\ruta\electron.exe"
npm run browser:smoke:native -- --autosave-only --electron "C:\ruta\electron.exe"
```

- `pulse-browser-smoke-W0bxx4/vault.json`: 4 comprobaciones aprobadas, exit 0.
- `pulse-browser-smoke-54Sira/autosave.json`: 7 comprobaciones aprobadas, exit 0.

Reportes bajo el directorio temporal del host. Sólo cuentas ficticias y página
loopback, sin bootstrap, agentes ni perfiles reales. La prueba genera entrada
confiable de Chromium mediante CDP; no afirma que fue interacción física humana.
No cubre el instalador, UI completa del producto, Windows Hello ni fallos
eléctricos. La reapertura de bóveda usa una instancia nueva en el mismo proceso.

### PostgreSQL local

PGlite 0.5.8 instalado en directorio temporal con `--ignore-scripts`; no se agregó
al manifest/lockfile del producto. Harness:

```powershell
node scripts/quality/test-browser-sync-sql.mjs "C:\ruta\node_modules\@electric-sql\pglite"
```

11 comprobaciones aprobadas, exit 0, reporte
`pulse-sync-sql-evidence-SuyIfM/report.json` bajo el temporal del host. El motor es
PostgreSQL 18.3 WASM; Auth es una fixture mínima. No verifica firma JWT real,
PostgREST, concurrencia entre conexiones, estado del proyecto Lia ni su versión
de PostgreSQL. Estas comprobaciones siguen siendo obligatorias antes del rollout.

## Revisión adversarial y correcciones

Se intentó refutar consentimiento con submit sintético, contextos ajenos, cambio
de origen de ida/vuelta y entrega tardía. Se mantuvo la restricción del marco
principal y el rechazo de revisiones anteriores. El test nativo detectó pérdida
de ofertas tras desconexión CDP: se corrigió limpiando el registro anterior y
usando un mundo único nuevo. También se evitó que una carga inicial tardía
sobrescribiera una preferencia confirmada/cancelada y que toggles acumularan
listeners de DevTools.

En persistencia, lecturas/migración entraron a la cola de flush y el borrado se
propagó al respaldo. No se restaura automáticamente una contraseña ya retirada.
En SQL se separó el rollback de `migrations/`, se revocaron grants de columnas
además de tabla y se comprobaron RLS sin depender sólo de los grants. Se intentó
re-registrar una sesión revocada y reutilizar su recibo; ambas acciones fallaron.
Las cuotas fallan cerrado sin borrar evidencia. El servidor no puede inspeccionar
secretos dentro de ciphertext arbitrario: la exclusión depende del contrato
cerrado de cifrado del cliente ya probado en 7.7.

## Entrega y pendientes

Progreso: **44/64 completas, 20 abiertas**. Se cierra 7.1; 4.8 y 8.7 avanzan sin
marcarse completas. La implementación sigue en el worktree indicado, sin mezclar
ni descartar trabajo anterior. El procedimiento de reversión está en
`docs/operations/release-and-recovery.md` (desde la raíz del repo): desactivar
ofertas no revierte el formato v2; no hacer downgrade sin lector compatible.
El rollback SQL conserva datos y requiere aplicación remota autorizada.

Pendientes generales:

1. 2.5: zoom verdaderamente aislado en el runtime estable.
2. 4.8: autenticación nativa, bloqueo/autobloqueo y ampliar formularios compatibles.
3. 4.10: passkeys del proveedor del SO.
4. 5.5: reputación en rutas restantes, intersticiales y smoke integrado.
5. 5.6: permisos por sitio para extensiones.
6. 5.7: catálogo firmado de extensiones.
7. 6.3: @pestaña, fuentes múltiples y citas.
8. 6.4: detener/pausar/tomar control end-to-end.
9. 6.5: handoff para acciones y datos sensibles.
10. 6.6: bitácora cifrada y retención.
11. 6.7: atajos agénticos reutilizables.
12. 6.8: índice semántico opt-in.
13. 6.9: voz de Orbe integrada.
14. 7.3: cliente sync con backoff/cancelación.
15. 7.4: resolución de conflictos del cliente.
16. 7.5: ciclo/UI de dispositivos y revocación integrada.
17. 7.6: activación, recuperación y desconexión en IPC/UI.
18. 8.5: runtime estable instalado/empaquetado y zoom.
19. 8.7: recuperación interactiva y migraciones de stores restantes.
20. 9.5: smoke completo de producto en Windows.

Un gestor equivalente completo a Proton requeriría además organización de bóvedas,
recuperación y, si se decide, un diseño específico de sync de credenciales; no
habilitarlo reutilizando el contrato actual que las prohíbe.
