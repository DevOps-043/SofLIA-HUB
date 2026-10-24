# Verificación de autorización de voz local

Estado: implementación verificada. Revisión independiente pendiente; no archivar.
Fecha: 2026-10-23. Rama: codex/reduce-technical-debt.

## Resultado y alcance

Ajustes y Orbe conservan canales/métodos, con caller de ventana/marco/documento,
contratos cerrados y consentimiento efímero main. Init no captura por enabled;
restaurar tras login pide revisión nueva. La guardia alcanza comandos y
notificaciones directos. Revocar cancela intención y puede parar el hijo
compartido, notificando a Meeting Live; el puerto conserva también avisos
ocurridos entre inicio y suscripción. Dictado/Piper tienen destinatario por ID,
sin broadcast, y la síntesis usa cancelación, lectura real limitada y prefetch
acotado. DTO público sin rutas ni errores libres; UI ofrece autorizar y detener
con solicitudes pendientes y su sondeo no solapa peticiones.

No se añadieron dependencias, canales, protocolos ni herramientas runtime. No
se ejecutaron modelos, micrófono, migraciones, cuentas ni despliegues. Se
preservan los cambios acumulados de las dieciséis unidades anteriores.

## Matriz y evidencia

| Criterio | Evidencia |
|---|---|
| Nueve voice:* deniegan sesión/ventana/marco/documento ajenos | local-voice-authorization.test.ts |
| Payload cerrado, límites y copia revisada inmutable | local-voice-authorization.test.ts y contrato main |
| Init sin captura y comandos/notificaciones sin grant bloqueados | voice-capture-boundary.test.ts |
| A/B/A, aprobación tardía, detener sin esperar y restauración cancelada | local-voice-authorization.test.ts |
| Instalación invocada pierde contexto sin falso rollback/retry | local-voice-authorization.test.ts |
| Un único destinatario y limpiezas antiguas no retiran el nuevo | local-voice-authorization.test.ts, python-runtime-voice-sessions.test.ts |
| Dictado invalida wake pendiente; stop antes de ready no envía captura tardía | python-runtime-voice-sessions.test.ts y python-sidecar-lifecycle.test.ts |
| Cuerpo excesivo/longitud falsa/aborto durante lectura | orb-tts.test.ts |
| Prefetch paralelo, cola limitada, cancelación y expiración antes de proveedor | voice-synthesis-queue.test.ts |
| Anuncios A/B/A no reaparecen tras abrir ventana | orb-announcements.test.ts |
| Reunión advierte interrupción y deja de reenviar audio | meeting-transcription-port.test.ts |
| Activar/detener UI y sondeo sin solapamiento | VoiceAuthorization.test.tsx |
| Preload/allowlist/IPC reales, perfil aislado y servicios/diálogos simulados | native-ipc.json |

Las 22 suites dirigidas terminaron con 377 casos aprobados. El smoke nativo
terminó con 12 comprobaciones. El build aislado de aplicación terminó sin
copiar .env ni iniciar la app. La compuerta completa aprobó 5391 casos y cinco omitidos en 198.65 s (487 archivos aprobados y dos omitidos); las once etapas terminaron correctamente. Lint revisó 239 archivos sin deuda nueva; documentación comprobó 659 archivos de prueba, 495 canales y 668 Markdown. Los resultados terminales están en gate-summary.json/build-summary.json.
Los contratos/fuentes se comprueban en contracts.json.

## Autorrevisión adversarial

Se intentaron refutar estas garantías mediante sesiones A/B/A, navegación,
subframes, Orbe oculta, payload mutable y malformado, revisión cancelada/tardía,
fallos después de invocar y operaciones concurrentes/reemplazadas. Se hallaron
cinco regresiones reproducibles de ownership: destinatario rechazado retenía
listeners, stop-speaking/conversation-ended antiguos limpiaban el nuevo y el
estado de dictado/wake admitía reanudaciones obsoletas. ownership-red.log
reprodujo cinco fallos; se corrigieron con ID capturado, limpieza específica,
liberación de contexto y revisión de intención de wake/dictado. La pérdida de
visibilidad durante activación también se reprodujo en visibility-red.log y
ahora retira captura incluso sin señal de navegación.

La verificación ampliada encontró además diez rechazos Calendar/Gmail fuera
del manejo de error al validar demasiado pronto el helper común. Se conservó
su contrato assert/dispose y las suites relacionadas quedaron verdes. La
primera compuerta/build se detuvo por tipo nullable de parent, corregido en la
siguiente iteración. Los intentos fallidos y los resultados actuales se conservan
en los logs temporales; no se cuentan como verificaciones aprobadas.

native-result-red.log reprodujo dos fallos adicionales: success:false de dictado/probe se evaluaba después de retirar la guardia de operación. Ahora se evalúa dentro y retira el hijo/grant ante un desenlace nativo incierto.

La primera compuerta completa aprobó 5389 casos y cinco omitidos; después del último ajuste se repitieron compuerta/build con el estado final y aprobaron 5391 casos, manteniendo cinco omitidos.
Esta es autorrevisión, no una revisión independiente. No se solicitó archivo,
publicación ni despliegue.

## Límites y recuperación

La identidad es la copia mínima main, sin nueva verificación remota. Los grants
no persisten ni atribuyen propietario a preferencias globales. Revocar puede
interrumpir el hijo usado por reuniones, con aviso; no certifica descendientes
del SO. Descargas/extracción aprobadas pueden terminar tras perder caller y se
comunican inciertas, sin garantía de integridad criptográfica/atomicidad ni
rollback. Logs semánticos, otros IPC, RLS y custodia de preferencias continúan
como deuda separada. El smoke no acredita hardware, audio ni interacción humana.

Rollback: revertir servicio/coordinador, handlers, preload/shared/wrappers y UI
como unidad; conservar las dieciséis unidades previas. No hay cambios de esquema
ni acciones remotas que revertir. Volver al comportamiento anterior reabre la
captura por enabled y entradas sin esta autorización.

No se recalcula el porcentaje global: el 50.375% histórico era un índice experto
ponderado, no SQALE, y requiere una auditoría comparable para actualizarse.


La copia final de build contiene 3383 fuentes y seis artefactos no vacíos; las 26 fuentes afectadas coinciden por SHA-256 con el worktree y no cambiaron durante la compuerta. El sandbox final es pulse-app-build-qHvUBl. Los comandos/logs se conservan en el directorio temporal soflia-voice-authorization-2026-10-22 y los resúmenes JSON en este directorio.

