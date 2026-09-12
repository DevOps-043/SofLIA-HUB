# Recuperación de bóveda e integridad de extensiones

Fecha: 2026-09-09. Implementación local en `upgrade-integrated-browser`, rama
`codex/upgrade-integrated-browser`. Continuación del corte de cinco cierres.
Sin SQL remoto, despliegue, cambios de secretos, instalaciones de extensiones
reales ni manipulación de perfiles del usuario. Datos de pruebas desechables.

## Entregado

- Recuperación nativa HITL de bóveda dañada, además de principal ausente.
  Valida formato, GCM y secretos internos. Rechaza principal válido, versión
  externa/interna futura, archivos no regulares, exceso de tamaño y fallos E/S.
  Conserva respaldo y copia cifrada de los bytes dañados antes del reemplazo.
- Copias protegidas con safeStorage y ámbito, máximo cinco; no se publican
  rutas ni secretos. La aprobación conserva TTL/contexto/consumo único y la
  restauración desactiva sugerencias. El botón ahora dice «Restaurar bóveda
  desde respaldo», sin introducir un canal ni aprobación nueva desde renderer.
- Borrar una credencial o vaciar la bóveda retira también las copias completas
  de recuperación, con aviso explícito. Un fallo no se anuncia como éxito.
- Extensiones: SHA-256 del inventario ordenado (ruta relativa, tamaño, hash)
  persistido al instalar y contrastado antes de cargar/restaurar/habilitar.
  Detecta archivos cambiados, añadidos o retirados y bloquea paquetes legacy sin
  huella. Una activa alterada se descarga al revisarla; una intacta no se recarga.
  La UI informa reinstalación revisada. Cuotas de directorios/profundidad,
  registros duplicados y máximo 100 instalaciones sin truncar datos.

## Verificación

- Primera dirigida de bóveda/extensiones/UI: 100 pruebas, tres archivos, exit 0.
- Tras incluir limpieza de copias: 113 pruebas, cuatro archivos, exit 0.
- Regresión amplia del mismo comando del [corte previo](verification-five-task-cut-2026-09-09.md):
  **1.045 pruebas / 76 archivos**, exit 0. Luego se añadió un caso de secreto
  interno corrupto y se repitieron ambos módulos: **62 pruebas / dos archivos**,
  exit 0. No se suman como pruebas independientes ni se afirma suite global verde.
- `npm run typecheck`: exit 0; `npm run lint:changed`: 191 archivos sin deuda nueva.
- `node scripts/quality/smoke-browser-native.mjs --vault-only --electron
  "C:/Users/fysg5/Desktop/SofLIA/Pulse Hub/SofLIA-HUB/.worktrees/upgrade-integrated-browser/node_modules/electron/dist/electron.exe"`:
  **11 comprobaciones nativas**, exit 0, Electron 43.4.0/DPAPI real.
  Último sandbox: `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-HlwNrj`.
- `npm run verify:pr`: adapters, harness, supply-chain, docs:system y docs:check
  aprobados (275 documentos enlazados, 419 canales, 441 archivos de pruebas).
  Se detiene, igual que antes, en `skills:seed:check` por divergencia entre
  `database/lia/migrations/system-skills-catalog.sql` y
  `src/shared/skills/registry.ts`, no modificados aquí. No se declara PR verde.
- OpenSpec estricto y diff check del alcance aprobados. Typecheck y lint se
  repitieron después del último ajuste de validación de secretos internos.

## Revisión adversarial y límites

Se probaron cambios de principal/respaldo/contexto, TTL, principal aparecido
durante publicación, fallo rename, permisos, cuota de copias, archivos ajenos,
fallo de limpieza, versiones futuras interiores/exteriores y credenciales
internas inválidas. Se corrigió el riesgo de conservar copias con contraseñas
después de borrar y se retiró la recarga innecesaria de extensiones intactas.

Las copias conservan los bytes revisados cifrados, no son envelopes v2 cargables
automáticamente. DPAPI no autentica presencia ni protege frente a procesos del
mismo usuario. La cola sólo serializa este proceso; la última comprobación no
constituye bloqueo de escritores externos. El borrado puede retirar algunas
copias antes de fallar y conserva la cuenta si no pudo emitir su escritura.

La huella de extensiones no autentica un editor: un actor que controle paquete
y registro puede cambiarlos juntos. Tampoco hay vigilancia continua después
de cargar. El registro sigue en versión 1 con campo adicional; un downgrade
puede omitirlo y la versión nueva exigirá reinstalar en lugar de confiar sola.
No se afirma compatibilidad del catálogo ni prueba nativa de extensiones: la
regresión usa archivos reales y dobles de la carga Electron.

## Pendientes y rollback

5.7 continúa abierta por catálogo curado, autenticidad y actualización explícita.
8.7 continúa abierta por migraciones/recuperación y rollback de otros stores.
**51/64 completas, 13 abiertas**; no se cierran tareas por avances parciales.
Permisos por sitio (5.6), OS auth/autobloqueo (4.8), passkeys y las otras tareas
siguen sin cambios. Instalador y Auth/RLS Lia reales no se ejecutaron.

Ante problemas de extensión, deshabilitar o reinstalar con revisión; no borrar
la huella para aceptar archivos nuevos. Ante fallo de recuperación, conservar
principal/respaldo/copias protegidas y revisar de nuevo; no copiar una cuarentena
encima del principal ni bajar la versión del formato. La documentación vigente
está en [arquitectura](../../../../docs/architecture/integrated-browser-platform.md).
