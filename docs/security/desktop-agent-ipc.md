# Desktop Agent: autoridad de IPC

Estado: vigente. Actualizado: 2026-10-27.

<!-- evidence: electron/desktop-agent-handlers.ts -->
<!-- evidence: electron/desktop-agent-handlers/authorized-registration.ts -->
<!-- evidence: src/shared/desktop-input.ts -->
<!-- evidence: src/shared/desktop-keys.ts -->
<!-- evidence: electron/preload/desktop-apis.ts -->
<!-- evidence: electron/desktop-agent/service-observation.ts -->
<!-- evidence: electron/desktop-agent/agent-config.ts -->

## Frontera y contratos

Los 23 canales desktop-agent exigen Hub/Orbe registrados, marco principal del
documento propio y revisión de usuario main. Startup proporciona getters de las
ventanas reales. Sin ventanas se deniega; tampoco basta encontrar cualquier
BrowserWindow. Se revalida tras cada espera del handler y no se publica resultado
revocado por logout, A/B/A, navegación o destrucción.

Cada canal valida una tupla cerrada; configuración cubre todos los campos de su
DTO, no acepta propiedades ajenas. Snapshot común rechaza getters/prototipos y
claves peligrosas antes de Zod; Desktop aplica cuota final de 128 KiB UTF-8.
Tarea/reglas/texto hasta 20000 caracteres, cuatro tareas por paralelo, coordenadas
finitas entre -100000 y 100000; URLs HTTP(S) sin credenciales. Configuración tiene
rangos por campo; el desktop visual conserva maxConcurrentAgents en uno.

Se conserva servicio/handler/allowlist/preload y wrappers tipados, sin canales
nuevos. getStatus/getConfig conservan DTO raw y rechazan con error fijo ante
denegación; los otros canales usan success/error. Los errores de IPC/excepciones
son fijos; outcomes exitosos o de dominio conservan contenido del servicio y
no se certifican como redactados de forma general.

## Revisión y controles

Tareas individuales/paralelas, configuración, reset de perfil, observación,
primitivas, foco y calibración requieren HITL nativo con cancelar predeterminado.
Se revisa el snapshot copiado: mutar opciones originales durante diálogo no
cambia la orden. Contenido extenso usa preview marcado y digest; esa revisión
de tarea no certifica cada paso de un modelo ni sustituye guardas internas.

Una mutación pendiente por emisor y cuatro globales; hasta 16 consultas y ocho
controles independientes, sin cola IPC. La plaza de mutación permanece hasta
que el servicio devuelva control. abort/abort-task/stop-observation autorizados
no requieren otro diálogo y no esperan plaza de una tarea pendiente. AbortAll
libera la lease de observación del handler. Control global afecta el servicio
compartido del mismo usuario; no asigna ownership de cada tarea a una ventana.

nativeActionReview del preload evita doble diálogo renderer sólo para
use_computer y reset_browser_profile; no omite revisión de host/nodos remotos.
El código main siempre revisa, incluso con clientes anteriores sin capability.
El diálogo nativo conserva su límite de dos minutos y un único diálogo físico.

## Tareas y observación

AbortSignal se añade sólo en main a cada tarea, incluido paralelo. Revocar
source/identidad aborta la señal y descarta respuesta tardía. Los servicios que
ya enviaron I/O/entrada pueden terminar efectos: no hay rollback ni cancelación
uniforme de cada backend interno. No se reintenta un efecto incierto desde IPC.

Observación retiene la lease del handler hasta stop/reemplazo/revocación. El
servicio también liga observación runtime a identidad main y generación. Stop
aborta su señal y retira intervalo. Tras captura/modelo y después de emitir la
acción se comprueba la generación antes de ejecutar; finally viejo no cambia el
estado de una generación nueva. El SDK recibe señal y timeout de 60 s por llamada.
Cancelar cliente no cancela necesariamente trabajo/coste ya admitido por proveedor.

Un ciclo físico pendiente conserva exclusión incluso tras reemplazo de
observación, sin acumular peticiones nuevas. Si el proveedor no termina, se omiten
ciclos hasta que devuelva control. No se acredita liberación a los 60 s exactos.

## Teclado y configuración

Teclas se convierten a tokens cerrados antes de driver o PowerShell. Windows
genera sólo códigos virtuales numéricos, con liberación en finally; no admite
fragmentos arbitrarios SendKeys. Se conservan aliases, F1–F24 y acordes como
ctrl++, con códigos OEM sujetos a distribución de teclado. Linux usa argv con
-- antes de texto y nombres de teclas traducidos; no shell.

La escritura Windows conserva clipboard/restauración, pero no sobrescribe un
cambio ajeno observado durante la espera. No garantiza arbitraje atómico con
otros procesos. Texto nuevo se acota a 20000 caracteres y no admite NUL.
Los otros drivers de mouse/ventanas mantienen sus contratos propios.

Config guardada se carga con cuota de archivo y validación por campo: valores
inválidos usan defaults y los válidos se preservan, incluida migración de captura.
El modelo se normaliza según la política existente. Guardar valida config completa,
escribe temporal exclusivo y renombra antes de publicar this.config/config-updated.
Si falla, propaga error fijo y conserva estado anterior. Sin fallback de escritura
a cwd. No acredita fsync/durabilidad ante fallo eléctrico ni locks entre procesos.

## Procedencia de publicaciones de tareas

Las entradas de tarea main capturan identidad/revisión y señal en un contexto
AsyncLocalStorage por servicio. Una continuación anidada conserva la lease;
si revoca no puede capturar otra identidad para continuar. La respuesta final
se revalida antes de volver al llamador, también fuera del IPC.

Task events, pasos, planes y recuperación requieren esa procedencia en el
EventEmitter Desktop. Se descartan si falta contexto, cambia cuenta (incluido
A/B/A), se cancela señal o termina la operación. Forwarding de BrowserWeb/UIA
verifica contexto antes de modificar marcas/status. No atribuye un evento al
usuario activo receptor. Configuración/observación conservan sus contratos
separados; el control por IPC sigue devolviendo su respuesta autorizada. Su aviso
task-aborted puede emitirse fuera de una tarea con sesión main vigente, pero sólo
con taskId (hasta 256 caracteres), sin texto privado ni permiso de aprendizaje.

Las colas Desktop, BrowserWeb y UIA guardan una continuación del contexto
originario. No heredan el del trabajo que libera plaza. Se preserva reserva
síncrona y orden FIFO; un rechazo síncrono resuelve por reject sin perder la
entrada. Las señales main llegan también a los contratos internos BrowserWeb/UIA;
no se añaden al DTO serializable del renderer.

El aprendizaje acepta sólo la copia emitida de task-completed/task-failed:
procedencia privada WeakMap en main, sin ownerKey/token de autoridad añadido al
payload. El modelo no fija propietario. Se usa snapshot de task/message admitido
antes de listeners, hasta 50000/100000 caracteres; si falta task se usa la tarea
originaria. Una copia/replay del objeto no conserva autorización. Se aprende una
vez por evento, revalidando antes de cada saveMessage y usando el propietario
originario, aunque otro registro auxiliar de usuario activo difiera.

El consumo actual es síncrono; después de cerrar lease no se autoriza aprendizaje
diferido. Dos saveMessage no son transacción: si falla o cambia cuenta entre ambas
puede quedar una escritura parcial en el propietario correcto, sin reasignar a
otra cuenta ni reintentar. No se deduplican emisiones distintas como si fueran un
único resultado durable. Sólo se rechaza replay del mismo evento admitido.

## Cancelación de etapas web y UIA

BrowserWeb y WindowsUIA revalidan la señal antes/después de decisiones,
capturas y llamadas controladas. Una decisión tardía no inicia entrada ni
otro intento de modelo. Clics, fill/select y escritura UIA compuestos comprueban
vigencia entre sus llamadas; cancelar impide sus siguientes efectos/fallbacks.
Las señales llegan al SDK como cancelación local, sin prometer detener trabajo
que el proveedor ya recibió.

El listener se enlaza antes de publicar inicio y permanece hasta finalizar;
la revocación durante preparación también se comprueba. Un consumidor inicial
o finalizador que falla no deja estado ocupado: limpieza y cola están en finally.
No se libera una plaza compitiendo con un timeout mientras aún hay I/O vivo.
Una traza ya iniciada conserva cierre; cancelar no inicia captura final adicional.

Estas guardas cubren fronteras instrumentadas. Una llamada de entrada, creación
de página/perfil o proveedor ya iniciada puede completar trabajo interno; no hay
reversión de efectos. Capturas/artefactos previos conservan su política y no se
acredita aislamiento global de perfiles o historiales con esta cancelación.
[Evidencia de backends](../../openspec/changes/guard-backend-task-cancellation/reports/verification.md).

## Límites y verificación

La procedencia anterior cubre publicaciones/aprendizaje de tareas, sin aislar
todas las mutaciones internas, historiales de backend, cachés o perfiles entre
cuentas. Autorizar una lectura
no prueba que todo el estado histórico del servicio provenga de ese usuario.
Esas rutas y los otros productores WhatsApp/HTTP conservan pendientes independientes.
Descartar una publicación no deshace I/O ni impide por sí solo toda mutación tardía
del estado compartido. Productores internos sin lease no pueden publicar eventos
de tarea; necesitan entrar por la API de ejecución para conservar procedencia.
Tampoco coordina entrada de todos los controladores del equipo ni acredita
permisos o comportamiento GUI real. La calibración pasiva no mueve el puntero;
el diagnóstico activo conserva aprobación y bloqueo ante tareas visuales activas.

Pruebas con fuentes/capturas/modelos/entrada sustituidos; persistencia usa sólo
directorios temporales propios y fallos inducidos. Sin GUI, cuentas ni claves
reales. [Evidencia](../../openspec/changes/secure-desktop-agent-ipc/reports/verification.md).
La [unidad de publicaciones](../../openspec/changes/bind-desktop-task-publications/reports/verification.md)
prueba sesiones/colas/forwarding/memoria con modelos y efectos sustituidos.
