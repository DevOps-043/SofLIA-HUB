# Verificación de custodia y sesión del calendario

Estado: implementación verificada localmente; revisión independiente pendiente. Fecha: 2026-10-22.
Rama: codex/reduce-technical-debt; base e166d250629e503cf12f69449fb6d66e569134c8.
Se conserva el trabajo de los dos bloques anteriores y los informes históricos.

## Alcance comprobado

| Requisito | Evidencia |
|---|---|
| Custodia cifrada, límites, dueño, rotación y escritura completa | calendar-credential-store.test.ts: 17 casos con filesystem real y AES-GCM de prueba; smoke DPAPI nativo |
| Legado conservado sin atribuir huérfanos ni resucitar desconexiones | casos de dos usuarios, propietario discordante, archivo privado vacío/corrupto y tres procesos Electron separados |
| Sesión A/B/A, cargas tardías, errores de disco y escrituras de ambos proveedores | calendar-session-lifecycle.test.ts |
| Cliente Google retenido y renovación tardía | transporte del SDK real con fetch de prueba, sin red; guardas antes de solicitudes y al devolver respuestas |
| Gmail/Drive/Chat | clientes reales del repositorio consumen el servicio y conservan la respuesta no conectado tras logout |
| IPC/confirmación/emisor/owner/errores seguros | calendar-ipc.test.ts y calendar-mutations.test.ts; no se agregan canales |
| Polling sin solapamiento ni emisión tras detener | calendario por revisión de sesión y token de ejecución; casos con timers simulados |
| Cierre de recursos | dispose idempotente y prueba de app-lifecycle; fixture nativo de lifecycle actualizado |
| Respuesta Microsoft tipada | calendar-event-fetchers.test.ts: 4 casos, fechas con/sin zona y entrada inválida |

## Comandos y resultados

- Baseline focalizado antes del bloque: 47 pruebas aprobadas.
- Almacén: 17 casos aprobados. Ciclo de vida/IPC/OAuth después de integrar el
  SDK real y mensaje seguro de llavero: 49 aprobados. Otros casos de proveedores,
  servicio, renderer y cierre se ejecutaron focalizados y se incluyen en el gate.
- ESLint de todos los archivos de electron/calendar, nuevos casos y runner
  nativo: salida 0. No se desactivaron reglas ni se añadieron supresiones.
- `node scripts/quality/smoke-calendar-custody.mjs`: salida 0. Electron 44.5.1,
  DPAPI real, tres procesos y perfil temporal soflia-calendar-native-LFLFen.
  Escritura/migración, reinicio/restauración y desconexión sin reimportación
  aprobaron; no se encontraron tokens ficticios planos en los archivos de custodia.
- `npm run calendar:smoke:native`: salida 0, segunda ejecución sobre la versión
  final con perfil temporal soflia-calendar-native-GVMM7N. Resultado persistente:
  [native-smoke.json](native-smoke.json).
- `npm run verify:pr`: salida 0. **4529 pruebas aprobadas, 5 omitidas, 0 fallos**;
  439 archivos aprobados y 2 omitidos, 204,91 segundos. Incluye tipos, lint sin
  incidencias nuevas, tooling, harness, documentación y OpenSpec. La suite agrega
  37 casos respecto al bloque anterior, manteniendo timeouts y omisiones.
- El catálogo documental deriva 607 archivos relacionados con pruebas y 494
  canales IPC. No hay canales nuevos. No se añadieron dependencias ni overrides.

Resumen persistente: [verification.json](verification.json).

Las primeras comprobaciones de tipos detectaron diferencias entre las copias
instaladas de Gaxios y una inferencia pública demasiado estrecha. Se corrigieron
los contratos explícitos; la prueba usa el SDK real y un fetch tipado. Su carga
fría se completa durante recolección, manteniendo los timeouts funcionales.
No se interpreta un fallo previo como éxito de la versión final.

## Revisión adversarial

Autorrevisión; no se presenta como revisión independiente. Se probaron archivos
corruptos/excesivos, dueño discordante, duplicados, campos extra, temporales
cancelados antes de rename, fallo de cifrado/disco, escrituras concurrentes,
cambio de sesión durante carga/HTTP/OAuth/refresh, clientes retenidos y polling
detenido. Se encontró y corrigió un evento reentrante: cada conexión restaurada
revalida identidad antes de emitirse, para no publicar la segunda cuenta de A
si un listener ya cambió a B. También se revalida después del evento de conexión.

## Límites y rollback

- No se leyeron ni migraron perfiles o credenciales reales, ni se modificaron
  secretos, .env, datos remotos o dependencias de proveedores.
- El cifrado depende del llavero/usuario del SO. Windows no protege de otros
  procesos bajo ese mismo usuario; Linux basic_text/unknown se rechaza. Falta
  validación nativa en Linux/macOS; no se infiere de Windows.
- Un archivo heredado inválido/excesivo se conserva intacto y bloquea la
  migración hasta recuperarlo explícitamente. Sin backend seguro no se escribe
  plaintext ni se completa una nueva conexión; el mensaje público indica llavero.
- Registros sin propietario permanecen cifrados y requieren reconectar; las
  claves compartidas del instalador y scopes OAuth amplios siguen pendientes.
- Una petición remota ya enviada puede haber producido efecto; logout no la
  revierte. Una escritura de disco cuyo rename ya comenzó tampoco es reversible
  por cambiar sesión, pero sólo afecta al archivo del propietario original.
- Rollback mantiene archivos cifrados y requiere reconectar en versiones viejas;
  nunca volver a plaintext. Sin revisión independiente, no se archiva el cambio.

Fuente de custodia y límites del SO: [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).
Fechas Microsoft por defecto en UTC: [contrato event](https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0).
Logs: C:/Users/fysg5/AppData/Local/Temp/soflia-calendar-custody-2026-10-22.
