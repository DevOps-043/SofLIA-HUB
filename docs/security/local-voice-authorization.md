# Autorización de voz local

Estado: vigente en el worktree. Cambios: secure-local-voice-authorization y fix-voice-automatic-setup.

<!-- evidence: electron/voice/session.ts -->
<!-- evidence: electron/voice-passive-handlers.ts -->
<!-- evidence: electron/orb-ipc-handlers.ts -->
<!-- evidence: src/shared/local-voice.ts -->
<!-- evidence: src/shared/orb.ts -->

La voz mantiene un sidecar compartido con la transcripción de reuniones y un
coordinador de autorización en main. La identidad utilizada es la copia mínima
de sesión de main: este cambio no añade verificación remota ni roles nuevos.
Las preferencias existentes siguen siendo de máquina, sin adjudicar al usuario
actual la propiedad de archivos heredados.

## Entradas y consentimiento

Los nueve canales `voice:*` conservan métodos y argumentos. Sólo admite ajustes
la ventana principal registrada, con su marco principal, documento de la app y
sesión actual. Orbe requiere su propia ventana visible para iniciar dictado o
consumir wake/anuncios. Detener, terminar conversación u ocultar admite la
ventana propietaria aunque esté oculta. Mostrar Orbe corresponde a main;
sintetizar/reproducir voz admite main y Orbe. Navegación, cambio de marco/ventana,
cierre de sesión y A/B/A invalidan llamadas anteriores. Payloads tienen aridad
y campos cerrados, sin coerciones de objetos ni selección inválida como default.

`enabled` es preferencia, nunca autorización. Init carga configuración y prepara
dependencias en segundo plano, sin activar el micrófono. Tras autenticar, main
restaura sólo una aprobación explícita recordada de la misma cuenta y firma de
dispositivo, modelo configurado y palabras. Si no existe, presenta revisión
nativa; cancelar conserva la voz inactiva. No se fabrica un evento IPC para
restaurar. La aprobación se recuerda en archivos versionados bajo
`userData/voice-consents`, nombrados con SHA256 del identificador de cuenta,
exclusivamente después de confirmar e iniciar correctamente. Una preferencia
enabled heredada no se migra a consentimiento. El grant activo sigue siendo
efímero y se invalida al cerrar sesión o cambiar cuenta A/B/A. La escucha pasiva
aprobada cubre dictado; dictado aprobado no concede escucha pasiva. Cambiar la
configuración exige aprobación correspondiente; durante dictado se rechaza cambiarla.

Las pruebas de micrófono requieren revisión temporal de 3 segundos; no conceden
escucha ni dictado. Python privado y Vosk pequeño se preparan automáticamente,
sin abrir el micrófono; modelo grande y voces opcionales mantienen revisión
nativa antes de descargar. Detener/deshabilitar revoca intención pendiente y
elimina el consentimiento recordado de la cuenta actual sin esperar aprobación.
Los controles muestran **Detener captura de voz** incluso
durante una solicitud pendiente. Preferencias reversibles sin captura y
reproducción local no agregan diálogos de autorización.

Hay una operación de revisión/activación por coordinador y un diálogo nativo
exclusivo con cancelar por defecto y plazo de 120 segundos. Una respuesta
tardía no activa captura. Los comandos `start_wake`, `start_dictation` y
`mic_probe` pasan una guardia main también al llamar directamente al servicio
o a su método de notificaciones. Wake/dictado comprueban parámetros del
dispositivo/modelo configurados antes de escribir al hijo.

## Datos, cancelación y recuperación

Los contratos compartidos conservan las cuatro capas: servicio, handlers,
allowlist/preload y wrappers tipados. El DTO público sustituye rutas internas
por `modelInstalled` y `approvalRequired`; errores se proyectan a vocabulario
controlado. Dictado y Piper vinculan IDs creados por main al consumidor antes
de esperar: no hay broadcast de texto/audio de esos flujos a todas las ventanas.
Reemplazar una reproducción interrumpe la anterior y retira su destinatario;
sus respuestas tardías no retiran la nueva. Navegación/cambio de cuenta retira
la entrega. La cola de anuncios descarta también entregas que esperaban abrir
una ventana al cambiar la sesión.

Revocar o fallar una activación ya invocada (incluido success:false del servicio)
puede detener el hijo completo para impedir activaciones
tardías, lo que interrumpe transcripción local compartida. El puerto de Meeting
Live conserva y avisa esa interrupción aun entre inicio y suscripción del
consumidor; deja de reenviar audio y no afirma haber drenado texto pendiente.
La persona puede detener la reunión y volver a iniciarla. No cambia el permiso
de captura renderer ni el protocolo de reuniones.

Una instalación aprobada e iniciada puede terminar después de perder caller.
La respuesta indica `uncertain`/`recoveryRequired`, sin repetir ni afirmar
rollback de archivos. Un cierre físico sin confirmar conserva las barreras de
reemplazo del transporte Python. No se certifica la terminación de descendientes
del SO ni la integridad criptográfica/atomicidad de los instaladores existentes.

La preparación automática comparte una promesa entre consumidores. Captura la
espera y revalida caller/cancelación antes del diálogo y del comando nativo.
Orbe muestra «Preparando voz…» hasta confirmar el inicio del dictado, en vez de
«Escuchando…»; el analizador de micrófono renderer tampoco se abre durante esa espera.
Python reutiliza el preparador con SHA256 fijado, staging y validación de imports;
se invoca en un proceso separado, sin shell ni hooks/credenciales heredados.
En desarrollo instala en `python-runtime`; la reparación empaquetada instala en
`userData/python-runtime`, sin escribir en resources ni usar Python del sistema.
El instalador incluye los inputs mínimos del preparador. Ajustes muestra
`setupState` (idle/runtime/model/ready/error), progreso de modelo y reintento.
`setupErrorCode` distingue `voice_setup_failed` de `voice_runtime_blocked`, sin
exponer stderr ni rutas. Una política de Control de aplicaciones de Windows
puede impedir cargar el runtime aun con archivo íntegro; la app lo informa y no
modifica esa política. No hay bucle de reintentos ni descargas de modelo grande
automáticas. La preparación ya iniciada puede terminar tras cancelar, pero nunca
concede captura tardía. El Vosk pequeño conserva su política de integridad previa.

La síntesis remota revalida caller antes/después de esperas y aborta la lectura
al invalidarse; limita bytes reales, incluidos errores. Conserva prefetch de
frases con concurrencia y espera acotadas. Los límites precisos y sus fuentes
están en [parámetros runtime](../architecture/runtime-parameters.md).

## Evidencia y límites de QA

Las pruebas de autorización/carreras usan servicios, diálogos y audio ficticios.
`npm run voice:smoke:native` usa Electron real, preload/allowlist e IPC, ventanas
ocultas y perfil temporal con red bloqueada. No usa hardware, credenciales ni
modelos reales, ni acredita interacción humana con el diálogo.
Evidencia y resultados en el [cambio OpenSpec](../../openspec/changes/secure-local-voice-authorization/tasks.md).
Quedan fuera la autorización de otros IPC, RLS, custodia por cuenta de las
preferencias de máquina, integridad de descargas y logs semánticos del servicio.

