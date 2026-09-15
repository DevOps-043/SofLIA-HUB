# Recuperación SQLite y estado sync — 2026-09-12

## Alcance y estado

Continúa la tarea 8.7 de `complete-integrated-browser-platform`. Este corte
implementa las piezas locales restantes: respaldo/recuperación de historial,
respaldo/recuperación de bitácora, reconstrucción de checkpoints y conflictos,
reversión coordinada de una recuperación sync interrumpida e integración
IPC/UI con pruebas de permisos, cancelación y fallos parciales.

Los cambios anteriores de esta sesión quedaron incorporados externamente en
los commits `0007057` y `5bbf244`. Se conservaron sin reescribirlos; el cierre
continúa en `codex/finish-browser-recovery`, desde `5bbf24472b244e5642de4140e9b09ef8feedc793`,
en `.worktrees/upgrade-integrated-browser`. No se modificó el checkout padre
ni se hizo commit, despliegue o migración remota durante este cierre.

## Comportamiento verificado

- SQLite genera snapshots consistentes mediante `VACUUM INTO`, incluidos datos
  en WAL, y los protege con safeStorage y ámbito absoluto. La rotación de 30 s
  evita una copia por evento. Un fallo de respaldo posterior al commit se
  advierte sin anunciar falsamente un fallo del guardado principal.
- Recuperación sólo ante ausencia/daño compatible: validación readonly,
  esquema cerrado, cuota, rechazo de sidecars, revisión de cinco minutos,
  un solo uso, comprobación de bytes y contexto antes de publicar.
- Historial/bitácora reaplican retención al confirmar; historial reconstruye
  FTS sin reimportar JSONL. Borrado/retención invalidan copias anteriores antes
  de retirar filas. Los originales dañados se conservan protegidos, hasta cinco.
- Sync conserva configuración, checkpoints y diario originales cifrados antes
  de reemplazar. Reconstruye metadata vacía con categorías pausadas; no restaura
  decisiones, claves, dispositivos ni envíos aprobados. No contacta a Auth/red
  ni aplica cambios a los datos del navegador.
- Un marcador durable bloquea operaciones ordinarias ante interrupción. La
  reversión HITL restaura bytes y ausencias originales sólo cuando los archivos
  coinciden con esa operación. Fallos durante la reversión conservan el bloqueo
  para reintentar; nunca se borran archivos ajenos para desbloquear.
- IPC conserva canales existentes y DTO cerrados, sin rutas ni consentimiento
  aportados por el renderer. UI ofrece recuperación aun si consultar estado
  falla, advierte del alcance y distingue cancelar de completar.

## Evidencia

- `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only`:
  **1443 pruebas aprobadas, 109 archivos**, inicio 21:57:34, duración 44,07 s.
  Selección del navegador y consumidores, no toda la suite del repositorio.
- `npm run lint:changed`: 10 archivos revisados sin deuda nueva respecto de
  HEAD. OpenSpec `validate complete-integrated-browser-platform --strict` y
  `git diff --check` aprobados; Git mantiene advertencias LF/CRLF, sin errores.
- `npm run browser:smoke:native -- --electron <worktree>/node_modules/electron/dist/electron.exe`:
  **99 comprobaciones aprobadas en diez fases**, Electron 43.4.0 real. Artefactos
  `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-gk3D8Y`. Incluye 19 casos
  de políticas/recuperación con DPAPI real y fallos de publicación inyectados.
- `npm run typecheck`: **no aprobado**. Único error observado:
  `electron/whatsapp/delivery-events.ts(25,6) TS6196 MessageUpdateEntry` sin usar.
  Se comprobó que ya existe en HEAD y que el archivo no tiene diff en este corte.
- `npm run verify:pr`: adapters (27), harness (25 rutas/9 skills), supply-chain
  (11 versiones vetadas/18 hooks), inventario (477 archivos de prueba) y enlaces
  en 291 Markdown pasan. **No aprobado**: se detiene en `skills:seed:check` por la
  discrepancia existente entre `database/lia/migrations/system-skills-catalog.sql`
  y `src/shared/skills/registry.ts`; ambos sin diff. No se regeneró SQL ajeno.
- La primera repetición de regresión detectó una aserción UI con el aviso
  anterior de retención (1442 aprobadas, una fallida). Se actualizó para exigir
  también el aviso de eliminación de copias locales; no se relajó la cobertura.

## Revisión adversarial local

Realizada por el agente principal; no sustituye revisión independiente para
archivar. Se intentaron refutar aislamiento, consentimiento, conservación de
evidencia, idempotencia y borrado mediante bases sanas/futuras/ajenas, copia
alterada o de otro ámbito, WAL, acceso denegado, quotas, cambios durante HITL,
cancelación tardía y expiración. La matriz sync inyecta fallo en cada uno de
los tres reemplazos, fallo de reversión y cambio externo; comprueba bloqueo
previo a diálogos/red y que la primera sincronización recuperada exige revisión
nueva sin escrituras locales/remotas. Se añadió rechazo de symlinks en lectura
ordinaria de checkpoints/diario y de escritura que encubra checkpoints dañados
o futuros. Se corrigió la rotación SQLite cuando el reloj retrocede.

No se detectaron nuevos hallazgos bloqueantes en estas rutas después de los
ajustes. No se afirma atomicidad multiproceso, durabilidad ante corte eléctrico,
recuperación tras pérdida del disco ni borrado forense. El historial principal
sigue siendo SQLite sin cifrado completo. La reversión de sync puede devolver
la corrupción original y no deshace cambios remotos. No hay rollback atómico
de todos los stores ni downgrade automático: la ruta de aplicación conserva
flags y restauración compatible con la app detenida. Marcadores ilegibles,
cambios externos o cinco archivos conservados requieren revisión operativa.

## Pendiente fuera de esta implementación

**63/64 tareas completas**: se cierra 8.7 y permanece abierta 9.5.

La tarea 9.5 requiere el recorrido manual completo del producto/instalador en
Windows, autenticación humana del SO y pruebas Auth/RLS/revocación entre dos
equipos reales antes del rollout de sync. Los fixtures locales y WebAuthn con
autenticador virtual no acreditan esas pruebas. El usuario conserva despliegue
y migraciones; no se ejecutaron. Los dos bloqueos generales de compilación y
semilla descritos arriba también impiden presentar este estado como release.
