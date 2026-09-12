# Verificación: atajos y configuración sync recuperables

Estado: evidencia histórica del corte local del 2026-09-12.
Worktree `upgrade-integrated-browser`, rama `codex/upgrade-integrated-browser`,
base `f52c8d6`. Continúa el [corte de políticas](verification-policy-recovery-2026-09-12.md).
No hubo commit, despliegue, instalación sobre el producto del usuario, cambio
de secretos ni activación de flags. Se preservó el checkout padre y su trabajo.

## Implementado

- Biblioteca de atajos v1: operaciones asíncronas serializadas por archivo,
  respaldo anterior protegido, flush en lifecycle, recuperación HITL desde
  soporte, nuevos IDs/revisión para invalidar editores viejos y ninguna ejecución.
  Eliminar un atajo retira todas las copias de recuperación de su biblioteca,
  con advertencia nativa; no elimina conversaciones ni páginas.
- Configuración sync v1: copia previa y rechazo de sobrescritura de un archivo
  corrupto/futuro/ajeno; `recover-settings` en el contrato existente del
  controlador/IPC/UI. Recupera con categorías vacías y fecha de ejecución nula,
  conserva binding, no activa red y no recupera claves, dispositivos, checkpoints
  o decisiones. Consulta disponibilidad local de clave antes de confirmar.
  Pausar limpia las copias locales de configuración, no revoca dispositivos.
- Helper de recuperación acepta codecs conservando los formatos principales
  existentes. Distingue incompatibilidad de versión/ámbito/cuota de corrupción
  recuperable; no permite que un principal de otro ámbito se reemplace.
- DTO de sync endurecido contra coerción de arrays a strings en acción/elección.
  Los canales no aumentan: 427 totales, 124 del navegador y 114 handlers.

Contrato canónico: [persistencia del navegador](../../../../docs/architecture/integrated-browser-platform.md#persistencia-y-recuperación).

## Evidencia ejecutada

| Comando | Resultado |
|---|---|
| `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only` | 1353 pruebas / 107 archivos aprobados; ejecución final 09:36:52 |
| `npm run test -- browser-shortcut-sync-recovery integrated-browser-sync-controller --maxWorkers=3 --reporter=dot --silent=passed-only` | 28 pruebas / 2 archivos aprobados tras ajustar preflight local de clave |
| `npm run browser:smoke:native -- --electron <worktree>/node_modules/electron/dist/electron.exe` | 90 comprobaciones / diez fases, exit 0, Electron 43.4.0 real |
| El mismo smoke con `--policies-only` | 10 comprobaciones DPAPI aprobadas sobre cinco stores |
| `npm run typecheck` | Aprobado en el estado final del código |
| `npm run lint:changed` | 293 archivos revisados sin deuda nueva; repetición final al cerrar |
| `npm run verify:pr` | Pasa adaptadores, arnés, supply chain, documentación de sistema y enlaces; se detiene en discrepancia preexistente de `skills:seed:check` |

`git diff HEAD -- database/lia/migrations/system-skills-catalog.sql src/shared/skills/registry.ts`
sin salida: no se modificaron las dos fuentes de la discrepancia. No se regeneró
SQL ajeno al navegador ni se acredita la suite global detrás del gate detenido.

La matriz nativa: exercise 12, restore 4, lifecycle 3, vault 11, autosave 11,
zoom 13, safety 12, passkeys 9, extensions 5 y policies 10. Usa loopback/fixtures,
sin bootstrap ni cuentas reales; catálogo opt-in externo no se repitió.
Evidencia conservada en `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-N5vt7R`;
fase aislada en `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-FDHWAP`.
No se borraron archivos personales; los borrados de tests afectan sólo sus
directorios temporales generados.

Inventario derivado: 473 archivos de prueba, 329 main, 143 renderer y uno de
scripts. No confundir inventario con número de casos ejecutados.

## Revisión adversarial del principal

Se intentó recuperar principal válido, futuro exterior/interior, de otro ámbito,
excesivo, ausente con copia, revisiones concurrentes y consentimiento cancelado
o tardío. Los originales permanecen sin reemplazo en rechazos. Las pruebas
cubren biblioteca reabierta con IDs nuevos, recibo obsoleto, límite de 50,
concurrencia entre instancias, ausencia con respaldo y limpieza tras eliminación.
Sync recuperado queda pausado y los dobles de conexión/adaptador no se invocan.
UI comunica recuperación/cancelación/fallo aunque la consulta inicial de ajustes
falle. DPAPI nativo verifica reapertura y contenido protegido en los dos stores.
No se solicitó revisión independiente ni se archiva el cambio en este corte.

La primera comprobación de tipos detectó una promesa de fixture inferida como
unknown; se tipó como boolean y se repitieron typecheck/pruebas. No se relajó
TypeScript, lint ni los criterios de aceptación.

## Pendientes y límites

**62/64 tareas completas; 8.7 y 9.5 siguen abiertas.** Dos almacenes adicionales
quedaron implementados, no toda la tarea 8.7.

- 8.7: respaldo/recuperación SQLite de historial, bitácora y memoria; checkpoints
  y diario de conflictos sync; verificación integral de rollback. Restaurar
  checkpoints antiguos sin reconciliar puede repetir efectos ya enviados; no se
  añadió un botón que copie esos archivos sobre estado activo.
- 9.5: recorrido completo del producto/instalador Windows, aceptación humana
  Windows Hello/passkeys y pruebas reales Lia Auth/RLS/revocación entre dos
  equipos tras despliegue autorizado. No se acredita ninguno por fixtures.

Atajos: 2 MiB; configuración: 8 KiB. Ambos conservan una generación previa y
hasta cinco originales dañados cifrados sin purga automática, revisión de cinco
minutos y guardas de contexto. La disponibilidad de cifrado seguro es obligatoria.
La copia depende del usuario del SO y del ámbito, no es E2EE portable. El primer
guardado no crea respaldo. Borrados pueden retirar copias antes de fallar el
guardado; se informa error sin prometer atomicidad multiarquivo, borrado forense,
exclusión multiproceso o resistencia a corte eléctrico.

Rollback operativo: conservar la build compatible, no renombrar copias cifradas
sobre JSON, desactivar transferencia mediante pausa y no recuperar dispositivos
revocados. Los flags no se cambiaron. Un downgrade no conoce estas barreras de
recuperación y requiere preservar el perfil detenido antes de cualquier prueba.
