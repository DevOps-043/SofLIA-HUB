# Autorización de voz local

Estado: vigente en el worktree. Cambio: secure-local-voice-authorization.

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

`enabled` es preferencia, nunca autorización. Init carga configuración sin
activar el micrófono. Tras autenticar, main puede presentar una revisión nativa
de la configuración guardada; cancelar conserva voz inactiva y ajustes ofrece
**Autorizar voz en esta sesión**. No se fabrica un evento IPC para restaurar.
El consentimiento no se persiste: queda vinculado a la sesión y al dispositivo,
modelo configurado y palabras revisadas. La escucha pasiva aprobada cubre
dictado y reanudación de esa misma sesión. Un cambio relevante mientras escucha
requiere nueva revisión; durante dictado se rechaza cambiar su configuración.

Las pruebas de micrófono requieren revisión temporal de 3 segundos; no conceden
escucha ni dictado. Instalar modelos o voces siempre pide revisión antes de
descargar/extractar. Detener/deshabilitar revoca la intención pendiente sin
esperar aprobación. Los controles muestran **Detener captura de voz** incluso
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

