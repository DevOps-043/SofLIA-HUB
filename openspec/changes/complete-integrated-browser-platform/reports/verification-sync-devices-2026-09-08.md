# Verificación: transporte y dispositivos de sync

Continuación de [conflictos y diario](verification-sync-conflicts-2026-09-08.md).
Alcance: [contexto de dispositivos](context-sync-devices-2026-09-08.md).
Rama `codex/upgrade-integrated-browser`, worktree `upgrade-integrated-browser`,
base `f52c8d6`. Se preservaron los cambios anteriores; sin commit, despliegue,
SQL remoto, configuración de secretos ni activación de flags.

## Implementación

Se completa **7.5 en código main/IPC/UI**. Progreso: **46/64, 18 abiertas**.
7.3 y 7.6 avanzan parcialmente, sin anunciar transferencia ni despliegue.

- `sync-remote.ts`: transporte main de endpoints cerrados para Auth,
  dispositivos y envelopes. HTTPS del proyecto configurado, sin redirecciones;
  cuerpo acotado y 20 segundos por solicitud incluyendo lectura/reintentos.
  Máximo tres intentos sólo ante error de red/429/5xx, backoff 250/750 ms;
  se conserva exactamente el cuerpo, trace e idempotencia de cada operación.
  Un 403 no se reintenta ni publica el cuerpo remoto.
- `sync-auth.ts`: usa la sesión Lia existente, valida vinculación, caducidad
  y forma de claims y comprueba el token con Auth. No confunde decodificación
  JWT con verificación ni crea login propio. Cambiar titular/session_id o cerrar
  sesión invalida la conexión; libera el listener al terminar.
- `sync-device-identity.ts`: ID aleatorio persistido antes del RPC, protegido
  íntegramente por el almacén del SO y ligado al perfil/sesión/backend. Cola por
  archivo, lectura acotada, temporal exclusivo, fsync y reemplazo. Corrupción
  y fallo de escritura conservan el principal. No transmite hostname/MAC.
- `sync-devices.ts`: registro/listado/revocación con sesión verificada,
  confirmación nativa y límite de 45 segundos. Sin flag o con perfil efímero no
  abre conexión. Una sola operación/confirmación; cancelación, ventana, perfil
  o revisión de control obsoletos impiden continuar tras las esperas.
- Cuatro IPC completos en servicio, handler, allowlist, preload y wrapper
  tipado. Sólo frame principal autenticado, argumentos cerrados y errores
  saneados. No expone tokens, claves, rutas, owner/session_id ni aprobación.
- Panel **Sincronización** en el gestor del navegador: consultar, registrar,
  revocar y cancelar. Desmontar cancela y descarta respuestas; `profileRevision`
  remonta el gestor al cambiar perfil. Distingue cancelación/error/registro y
  aclara que registrar todavía no transfiere datos.

## Revisión adversarial

Se corrigieron dos carreras detectadas por revisión independiente:

1. Consentimiento y E/S después de tomar/devolver control al agente: cada guard
   captura `agentControlRevision`, no sólo el booleano actual. Volver a humano
   no rehabilita una aprobación anterior; se impide el RPC tras E/S tardía.
2. Revocación entre consultar `active` y leer dispositivos: una lista vacía,
   sin activos o con el dispositivo local revocado/ausente ya no publica
   `registered`; solicita reconsultar sin inventar registro ni reactivar.

También se cubren cancelación durante fetch, backoff o cuerpo bloqueado;
exceso de bytes, respuesta malformada, categorías cruzadas, recibos inválidos,
campos secretos adicionales, identidad dañada, reemplazo fallido, aprobación
tardía, frames ajenos y payloads adicionales. `exp` rechaza fracciones y
desbordamientos. El rechazo IPC de cancelar se informa sin anunciar que terminó.

## Evidencia y límites de la ejecución

La primera regresión amplia de esta fase aprobó 66 archivos/871 pruebas antes
de las correcciones adversariales. Las nuevas pruebas del factory Auth añaden
25 casos sin red. Verificación final:

| Comprobación | Resultado |
|---|---|
| Regresión ampliada (comando inferior) | 67 archivos / 905 pruebas aprobadas |
| `npm run test -- integrated-browser-sync --run --maxWorkers=1` | 5 archivos / 99 pruebas aprobadas |
| `npm run test -- BrowserSyncPanel --run --maxWorkers=1` | 1 archivo / 6 pruebas aprobadas |
| `npm run typecheck` | Aprobado |
| `npm run lint:changed` | 119 archivos, sin deuda nueva |
| `npm run openspec:validate` | 26 cambios aprobados en modo estricto |
| `npm run docs:system:check` | 415 canales / 430 archivos de pruebas, válido |
| `npm run docs:check` | 273 Markdown activos, enlaces válidos |

```powershell
npm run test -- integrated-browser browser-history-clear-range browser-site-permissions BrowserTab BrowserPrivacyPanel BrowserRuntimeSupportPanel BrowserNavigationSafetyNotice BrowserSyncPanel IntegratedBrowserPanel password-generator whatsapp-delivery-events preload.test shutdown-guard app-lifecycle updater-service updater-hooks window-controller skill-workspace-service gemini-cu desktop-agent-computer-use --run --maxWorkers=1
```

`npm run verify:pr` aprobó adaptadores (27), arnés (25 rutas/9 skills), supply
chain, docs:system (28 documentos, 150 IDs, 415 canales, 430 archivos de pruebas)
y enlaces (273 Markdown activos en la última ejecución). Se detuvo en `skills:seed:check` por la
discrepancia preexistente entre `database/lia/migrations/system-skills-catalog.sql`
y `src/shared/skills/registry.ts`; ambos sin diff respecto a HEAD en esta fase.
No se presentan como aprobados los pasos posteriores que esa compuerta no ejecutó.

Se intentó además `npm run test -- --run --maxWorkers=1`. La ejecución global
no terminó: un worker consumió CPU varios minutos sin progreso y se detuvo con
Ctrl+C; se comprobó que sus procesos finalizaron. Antes de detenerla informó
dos fallos de limpieza de perfiles, uno de presentación WhatsApp y cinco de
información del sistema Computer Use. No hubo resumen global final; los fallos
de otros módulos no se clasifican como preexistentes sólo porque estén fuera
del diff. La suite global no está aprobada.

Los dos fallos de limpieza fueron `EPERM` al crear la ruta fija del mock
`C:\tmp\test-temp\integrated-browser\perfiles\sin-sesion`, fuera del sandbox.
Tras autorización, la misma suite de servicio pasó 2 archivos/139 pruebas;
la regresión ampliada final también se ejecutó autorizada y pasó. No se cambió
el producto ni se relajaron sus guardas para solventar un permiso del runner.

El comando `npm run test -- whatsapp-workflow-presentacion computer-use-handlers --run --maxWorkers=1`
reprodujo separadamente 6 fallos y 116 aprobaciones: WA-160 espera `index.html`
pero el workflow entrega `deck.json`; CU-062..066 esperan `success:true` al
consultar información del sistema y reciben `false`. No se modificaron esos
contratos ni sus tests en esta fase.

El diagnóstico de esas rutas confirmó ausencia de diff frente a `f52c8d6`:

- WhatsApp tiene una incompatibilidad funcional previa: el generador pide HTML,
  lo escribe en `policy.entryFile` (`deck.json`) y usa el exportador antiguo;
  el servicio real exige JSON válido. No basta cambiar la expectativa del test.
  Evidencia: `electron/presentation-workflow/html-generator.ts`,
  `src/shared/skills/presentaciones-skill.ts` y `electron/skill-workspace/service.ts`.
- Computer Use depende de `os.userInfo()` sin aislarlo; una sonda de lectura
  confirmó `ERR_SYSTEM_ERROR/uv_os_get_passwd` en ese entorno y éxito en las
  otras diez llamadas del SO. El catch global devuelve `success:false` aunque
  CPU/memoria estén disponibles. No demuestra fallo universal de Windows;
  sí deuda de tolerancia a permisos/aislamiento en
  `electron/computer-use/process-system-tools.ts`.

Ambos hallazgos quedan sin corregir aquí para no mezclar el bloque de sync con
la migración de presentaciones ni cambios al catálogo runtime del agente.

## Rollout pendiente y rollback

Esta fase no aplica la migración Lia ni cambia variables locales. Las pruebas
usan HTTP/Auth/safeStorage simulados y archivos temporales, no dos dispositivos
reales. La evidencia nativa DPAPI/SQL de fases anteriores no acredita esta UI
completa ni Auth/PostgREST desplegados. Staging autorizado debe verificar firma
JWT, sesión federada/refresh, RLS, pérdida de respuesta y revocación entre equipos.

Registrar sólo habilita el contrato de dispositivos. 7.3 todavía necesita
adaptadores de stores locales, checkpoints, aplicación consistente entre
categorías y conexión con el diario; 7.6 necesita activación selectiva, claves,
recuperación y UI de conflictos. No sincroniza contraseñas, passkeys ni cookies.

Cancelar aborta espera/solicitud local, no revierte una escritura ya recibida.
El diálogo nativo puede permanecer hasta responder, pero aceptar tarde no
autoriza mutaciones. Revocar no borra copias descargadas. El archivo de identidad
no es portable ni recuperable con la clave E2EE; DPAPI no autentica presencia
ni protege contra otros procesos del mismo usuario del SO.

Rollback: deshabilitar `BROWSER_ENCRYPTED_SYNC_ENABLED` y reiniciar, conservando
identidad, claves y diario. Esto no revoca dispositivos remotos. No borrar el ID
para reintentar después de un resultado incierto; consultar con la misma sesión.
Una sesión revocada necesita nueva autenticación y consentimiento explícito.
Guía canónica: [dispositivos de sincronización](../../../../docs/operations/release-and-recovery.md#dispositivos-de-sincronización).
