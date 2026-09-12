# Verificación: recuperación restrictiva de ajustes

Estado: evidencia histórica del corte local del 2026-09-12. Cambio
`complete-integrated-browser-platform`, rama `codex/upgrade-integrated-browser`,
base HEAD `f52c8d6`, worktree aislado `upgrade-integrated-browser`.
Los cambios previos y el checkout padre se conservaron; no hubo commit,
despliegue, modificación de secretos ni activación de flags.

## Resultado y alcance

Avanza 8.7 en permisos por sitio, privacidad y políticas del agente. Mantienen
JSON principal v1, respaldan una generación previa válida con safeStorage y
permiten recuperación explícita de principal ausente/corrupto. Main valida
ámbito, formato, cuota y bytes; exige titular, control humano, revisión de cinco
minutos y confirmación nativa con cancelar por omisión. No restaura concesiones:
permisos ask/denied, privacidad estricta sin excepciones y agente strict/ask/block,
manteniendo administrados bloqueados. No modifica empresa ni sync.

Se conectaron helper, tres stores, servicio, handler, allowlist, preload,
wrapper tipado y panel de soporte. Restablecer permisos retira todas sus copias
locales con aviso. Caché restrictiva se publica sin una segunda lectura y flush
espera la recuperación en curso. Contrato canónico:
[persistencia y recuperación](../../../../docs/architecture/integrated-browser-platform.md#persistencia-y-recuperación).

## Comandos y resultados

- `npm run test -- integrated-browser Browser browser- orb-show-handler orb-conversation desktop-agent-computer-use-lifecycle gemini-cu-loop gemini-cu-client preload --maxWorkers=4 --reporter=dot --silent=passed-only`: **1334 pruebas, 106 archivos, aprobados**. Es regresión focalizada amplia, no la suite completa del repositorio.
- `npm run browser:smoke:native -- --electron <worktree>/node_modules/electron/dist/electron.exe`: **86 comprobaciones, diez fases, exit 0**, Electron 43.4.0 real. Desglose: exercise 12, restore 4, lifecycle 3, vault 11, autosave 11, zoom 13, safety 12, passkeys 9, extensions 5, policies 6. Catálogo opt-in con red no se repitió en este corte.
- Fase nueva `--policies-only`: también aprobó seis comprobaciones aisladas con DPAPI real. La matriz posterior usa la implementación final de caché.
- `npm run typecheck`: aprobado.
- `npm run lint:changed`: **292 archivos**, sin deuda nueva.
- `npm run verify:pr`: adapta/arnés/cadena de suministro/documentación de sistema/enlaces pasan; se detiene en `skills:seed:check` por discrepancia preexistente. `git diff HEAD -- database/lia/migrations/system-skills-catalog.sql src/shared/skills/registry.ts` no produce cambios. No se regeneró SQL ajeno al alcance.
- `npx openspec validate complete-integrated-browser-platform --strict` y `git -c core.safecrlf=false diff --check`: aprobados antes del cierre documental; se repiten después del reporte.

Evidencia nativa local conservada en
`C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-SAi84h`;
fase inicial en `C:/Users/fysg5/AppData/Local/Temp/pulse-browser-smoke-yDAbqf`.
Sólo contiene perfiles/archivos de prueba. No se borraron datos personales.
El inventario documental deriva **472 archivos de prueba** (328 main, 143
renderer y uno de scripts), no confundir con casos ejecutados. IPC: **427
canales**, grupo 5 **98**, navegador **124**, handlers invocables **114**.

## Revisión adversarial y correcciones

- Revisión separada detectó que invalidar caché y releer podía regresar
  temporalmente a defaults menos restrictivos. Ahora se publica la proyección
  validada y se rechazan lecturas tardías de permisos sin borrarla. Cinco pruebas
  nuevas incluyen E/S posterior fallida, publicación síncrona y commit rechazado.
- Publicar con link y fallar limpiando el temporal podía informar error después
  de completar. Se distingue publicación de limpieza: mantiene resultado/copia
  y avisa sin rutas; no borra el original protegido como si hubiese fallado.
- DTO rechazaba claves extra pero admitía arrays por coerción del nombre de
  store. Ahora exige string literal; negativos `['privacy']`, `['permissions']`
  y `__proto__` no pueden seleccionar otro almacén bajo etiqueta incorrecta.
- Se probaron revisión repetida/concurrente, cambios de principal/respaldo,
  expiración, cuotas 8 MiB/cinco originales, EACCES, versiones futuras, respaldo
  ajeno, fallo de respaldo/rename/cifrado, flush en los tres stores y preservación
  de `managed`. Pruebas service cubren cancelar, sesión A→B→A, control A→B→A y
  cambio de perfil durante el diálogo. UI ignora acuses obsoletos/incompletos.
- Una prueba de cámara dependía de seis ciclos de event-loop; ahora espera
  explícitamente la respuesta de permiso con plazo de Vitest. Lint detectó
  setState en efecto: panel interno se remonta por perfil y descarta respuestas
  de componentes retirados, sin deshabilitar reglas.

## Límites y pendientes reales

**62/64 completas**, siguen abiertas **8.7 y 9.5**. No se cierra una tarea por
haber cubierto sólo parte de sus almacenes.

1. 8.7: respaldos/recuperación de atajos, SQLite (historial/bitácora/memoria),
   estados protegidos de sync y verificación integral de rollback.
2. 9.5: flujo completo del producto/instalador Windows; interacción humana real
   con Windows Hello/passkeys; despliegue autorizado y pruebas Lia Auth/RLS/
   revocación con dos equipos reales antes de rollout.

La confirmación UI/IPC usa dobles en tests; el harness no simula DPAPI pero sí
invoca directamente stores con guardas de fixture. No acredita interacción
humana ni producción. Primera creación de JSON no genera respaldo. Copias no
son E2EE portables; el principal sigue siendo metadata JSON. Se conservan una
generación y hasta cinco originales cifrados sin purga automática; fallar la
limpieza de temporales puede dejarlos en disco. Restablecer permisos puede
retirar copias parcialmente antes de fallar el guardado. No se promete borrado
forense, exclusión multiproceso ni recuperación tras corte eléctrico/pérdida
del disco. No restaurar manualmente permisos o dispositivos revocados desde
copias antiguas ni hacer downgrade sobre archivos incompatibles.
