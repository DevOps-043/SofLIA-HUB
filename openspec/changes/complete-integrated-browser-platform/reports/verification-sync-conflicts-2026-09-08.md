# Verificación: resolución y conservación de conflictos de sync

Continuación de [bóveda, guardado sugerido y esquema remoto](verification-password-manager-and-sync-2026-09-07.md).
Alcance y no objetivos: [contexto de 7.4](context-sync-conflicts-2026-09-08.md).
Rama `codex/upgrade-integrated-browser`, worktree `upgrade-integrated-browser`,
base `f52c8d6`. Se preservaron cambios previos, sin commit/PR, cambios de secretos,
dependencias, activación de red de datos ni aplicación SQL remota.

## Resultado

Se completa **7.4 como componente main local**. Progreso: **45/64, 19 abiertas**.
Esto no activa sincronización ni completa sus adaptadores/IPC/UI (7.3/7.6).

- `sync-conflicts.ts`: reconciliación de tres vías sobre una base explícita,
  por ID/campo y presencia. Cambios independientes se combinan; mismo campo,
  borrado/edición e ID nuevo colisionado conservan ambas variantes. Etiquetas
  se tratan como conjuntos y el orden es posición/ID, sin ganador por reloj.
- No se truncan uniones sobre cuota ni se devuelve un payload parcial. Cada
  decisión local/remoto está ligada a una huella de versiones y contenido
  saneado; selecciones ajenas/duplicadas/obsoletas se rechazan.
- `sync-conflict-store.ts`: instantáneas y decisiones completas bajo safeStorage
  por perfil, cola por archivo, temporal exclusivo sincronizado y reemplazo.
  Reapertura conserva pendientes. Corrupción, versión futura, cuota o E/S no
  se convierten en lista vacía ni reemplazan el principal. Una nueva revisión
  de la misma categoría no sobrescribe otra pendiente.
- Rebase tras CAS posterior: sólo después de decidir, conserva el resultado
  como local, usa el remoto anterior como base y crea IDs de revisión nuevos.
  Retirar el diario exige estado resuelto y revisión de commit siguiente;
  corresponde al futuro cliente comprobar commit remoto y aplicación local.
- `sync-crypto.ts`: la reconciliación reutiliza el mismo contrato cerrado y
  límite de 2 MiB, no crea una ruta alternativa para secretos. También rechaza
  registros con prototipo arbitrario y sanea errores de URL inválida.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| `npm run test -- integrated-browser-sync --run --maxWorkers=1` | 3 archivos, 46 pruebas aprobadas |
| Regresión ampliada (comando inferior) | 64 archivos, 839 pruebas aprobadas; antes 62/799 |
| `npm run typecheck` | Aprobado |
| `npm run lint:changed` | 111 archivos, sin deuda nueva |
| `npm run openspec:validate` | 26 cambios aprobados en modo estricto |
| `npm run verify:pr` | Falla en `skills:seed:check` por discrepancia preexistente SQL/registro; ambos sin cambios |

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel BrowserNavigationSafetyNotice IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --run --maxWorkers=1
```

Antes de la parada de `verify:pr` pasaron adaptadores (27), arnés (25 rutas/9
skills), supply-chain, docs:system (28 documentos, 150 IDs, 411 canales y 427
archivos de prueba) y enlaces documentales. No se afirma que pasaron las
compuertas que ese fallo impidió alcanzar ni la suite global completa.

### DPAPI nativo

```powershell
npm run browser:smoke:native -- --vault-only --electron "C:\ruta\electron.exe"
```

Electron 43.4.0, Chromium 150.0.7871.224, Node 24.18.1; runtime oficial aislado
verificado por SHA-256 en la fase anterior. **7 comprobaciones, exit 0**:
4 de bóveda/migración ya existentes y 3 nuevas de diario real, decisiones
persistentes y rechazo de alteración/copia entre perfiles.

Reporte conservado en el temporal del host:
`pulse-browser-smoke-6lh1Wb/vault.json`. Sólo datos ficticios; no bootstrap ni
perfiles reales. La reapertura usa instancias nuevas, no un reinicio de Windows.
No se verificó Windows Hello, otro usuario del SO, UI completa, instalador ni
integración real con Supabase. El observador y SQL no se volvieron a ejecutar
en esta fase; su evidencia está en el reporte anterior.

## Revisión adversarial

Se probaron borrados contra ediciones en ambos sentidos, alta con ID colisionado,
ausencia frente a null, cambios independientes y uniones sobre cuota. Se intentó
aplicar una elección vieja al recibir otra revisión; no se acepta. Se añadió
rebase para evitar quedar atrapado en un CAS posterior sin descartar una decisión
pendiente. Una decisión no autoriza por sí misma una aplicación local/remota.

También se forzaron corrupción, versión futura, archivo sobre cuota, falta del
almacén del SO, fallo de descifrado/rename, copia de perfil y contexto obsoleto.
Las escrituras usan destino e inputs capturados antes de esperar. La lectura
queda acotada incluso si un escritor externo hace crecer el archivo tras stat;
no se afirma coordinación de archivos entre procesos externos. No se imprimen
payloads ni causas nativas en el contrato de persistencia.

Los primeros ensayos corrigieron incompatibilidad de `Object.hasOwn` con la
lib TypeScript del proyecto y aislamiento de un mock que dejaba safeStorage
deshabilitado para el siguiente caso. Las verificaciones finales son las
indicadas arriba, sin ocultar fallos ni ampliar baselines.

## Límites y rollback

El diario es local/protegido por el SO, no E2EE transferible con código de
recuperación; DPAPI no protege frente a otros procesos del mismo usuario.
Contraseñas, passkeys, cookies y formularios siguen excluidos. No se asume
ausencia de datos sensibles escritos voluntariamente en títulos/etiquetas.

Faltan adaptadores que acrediten base común, validen nuevas ediciones locales,
relaciones grupo/pestaña y carpetas, controlen CAS real, recojan HITL y confirmen
commit antes de retirar la revisión. No enviar variantes o decisiones a agentes
ni exponer este diario directamente por IPC. No hay consumidores activos nuevos.

Reversión: mantener sync apagado, preservar el diario y usar un lector compatible;
no borrar pendientes ni restaurarlos automáticamente. Puede quedar temporal
cifrado si falla su limpieza. Operación canónica en
[release y recuperación](../../../../docs/operations/release-and-recovery.md#revisiones-locales-de-sincronización).

## Las 19 tareas abiertas

1. 2.5: zoom realmente aislado por pestaña en runtime estable.
2. 4.8: autenticación del SO, bloqueo/autobloqueo y ampliar formularios compatibles.
3. 4.10: passkeys del proveedor del SO.
4. 5.5: reputación en rutas restantes, intersticiales y smoke integrado.
5. 5.6: permisos por sitio de extensiones.
6. 5.7: catálogo firmado de extensiones.
7. 6.3: @pestaña, fuentes múltiples y citas.
8. 6.4: detener/pausar/tomar control end-to-end.
9. 6.5: handoff para acciones/datos sensibles.
10. 6.6: bitácora cifrada y retención.
11. 6.7: atajos agénticos reutilizables.
12. 6.8: índice semántico opt-in.
13. 6.9: voz de Orbe integrada.
14. 7.3: cliente y adaptadores sync con backoff/cancelación.
15. 7.5: dispositivos y revocación integrados.
16. 7.6: activación, recuperación y desconexión IPC/UI.
17. 8.5: runtime estable instalado/empaquetado y zoom.
18. 8.7: recuperación interactiva y migraciones restantes.
19. 9.5: smoke completo del producto en Windows.
