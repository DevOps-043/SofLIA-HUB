# Recuperación conservadora de memoria SQLite — 2026-09-12

## Alcance implementado

Continuación de `complete-integrated-browser-platform`, tarea 8.7. La memoria
semántica guarda un respaldo SQLite vacío protegido por el SO, ligado a su
archivo; no copia fuentes ni vectores derivados. Soporte añade `semantic` al
DTO cerrado de recuperación existente (sin canales nuevos). Main exige perfil
autenticado, recibo vigente, control humano, gate y confirmación nativa. El
índice recuperado queda vacío y desactivado, sin consultar fuentes ni Gemini.

Ausencia con respaldo bloquea creación ordinaria; un payload ilegible no se
sobrescribe al guardar. Se rechazan principales sanos, futuros, de otro ámbito,
con esquema desconocido, excesivos o con WAL/SHM/journal. Revisión de cinco
minutos, un solo uso y comprobación de bytes/contexto antes del reemplazo.
Original dañado protegido y acotado a cinco copias; la siguiente escritura
válida retira cuarentenas antes de guardar. El respaldo vacío permanece.

## Evidencia ejecutada

- `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only`: **1379 pruebas, 107 archivos, aprobadas**. Última ejecución 10:12:14, duración 58,67 s. Es la selección del navegador y consumidores, no toda la suite del repositorio.
- `npm run typecheck`: aprobado en el estado final de código y pruebas.
- `npm run lint:changed`: **294 archivos**, sin deuda nueva.
- `npm run browser:smoke:native -- --electron <worktree>/node_modules/electron/dist/electron.exe`: **92 comprobaciones, diez fases**, Electron 43.4.0 real. Artefactos locales conservados en `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-EqPtgU`.
- `npm run browser:smoke:native -- --policies-only --electron <worktree>/node_modules/electron/dist/electron.exe`: **12 comprobaciones**, repetidas tras el ajuste final del helper. Artefactos `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-PtwlHv`. Verifica DPAPI real, rechazo de alteración y reapertura SQLite vacía, además de políticas/atajos/configuración sync existentes.
- `npm run verify:pr`: adapters 27, harness 25 rutas/9 skills, supply-chain 11 versiones vetadas/18 hooks, documentación 28 documentos/150 IDs/427 IPC/473 archivos de prueba y enlaces en 284 Markdown aprobados. Se detiene en **`skills:seed:check` preexistente**; `git diff HEAD -- database/lia/migrations/system-skills-catalog.sql src/shared/skills/registry.ts` vacío. No se regeneró SQL ajeno a este cambio.
- OpenSpec `validate complete-integrated-browser-platform --strict` y `git diff --check`: aprobados; Git conserva advertencias de normalización LF/CRLF existentes.

Una primera prueba de cuota agotó el heap al comparar profundamente dos buffers
de 16 MiB con Vitest. Se corrigió la aserción usando `Buffer.equals`, sin
aumentar memoria ni reducir la cuota probada. Un hallazgo inicial de lint
`no-unsafe-finally` se corrigió separando la limpieza en una función. Ninguna de
esas ejecuciones fallidas se cuenta como aprobada.

## Revisión adversarial local

Realizada por el agente principal; no sustituye revisión independiente antes
de archivar. Casos negativos cubren cancelación nativa, sesión salir/volver,
control humano/agente/humano, gate desactivado, marco IPC ajeno, DTO ampliado,
ausencia, formato SQLite y payload dañados, principal sano/futuro/ajeno,
esquema extraño, cuota, acceso denegado, SO sin cifrado, backup de otro archivo,
WAL, cambio de bytes/contexto, caducidad y fallo de publicación. Dos revisiones
del mismo daño no pueden publicar dos recuperaciones. Un fallo de limpieza
posterior a publicación no anuncia falsamente que falló recuperar.

Se corrigió además el rechazo de symlinks rotos en la apertura normal y se
evita limpiar un temporal que esta operación no logró crear. No se leen ni
modifican secretos, `.env`, datos personales reales, claves o dispositivos sync.

## Pendientes y límites

**62/64 tareas de alto nivel completas**; 8.7 y 9.5 siguen abiertas. Este corte
termina la recuperación de memoria semántica, no toda 8.7. Falta recuperación
SQLite de historial/bitácora, checkpoints y diario de conflictos sync y rollback
integral. No se debe restaurar una identidad revocada, repetir envíos pendientes
ni reutilizar decisiones antiguas al recuperar sincronización.

El usuario se encarga del despliegue y las migraciones remotas. No se ejecutaron.
La prueba completa del producto/instalador Windows, Windows Hello humano y
Auth/RLS/revocación entre dos equipos reales no quedan acreditadas por la matriz
nativa aislada. No hay promesa de recuperación tras pérdida de disco, bloqueo
multiproceso, durabilidad ante corte eléctrico ni borrado forense. La limpieza
de cuarentenas puede ser parcial si falla el guardado posterior. No se archiva
el cambio ni se presenta como candidato a release.
