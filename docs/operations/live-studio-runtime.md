# Operación del estudio síncrono

El cambio `migrate-zoom-video-sdk` añade Video SDK junto al Meeting histórico. La guía canónica de activación del servidor vive en `SofLIA-Learning/docs/live-video-sdk.md`; la migración coordinada es `20261019120000_live_video_sdk.sql`. No se activó el proveedor ni se modificaron secretos o producción. El Hub selecciona el SDK mediante el grant autorizado y empaqueta los recursos multimedia locales. Video ofrece controles en español, nueve cámaras visibles y pantalla compartida; requiere conectar audio para escuchar. Los requisitos siguientes corresponden a las aulas Meeting.

<!-- evidence: packages/zoom-runtime/video-runtime.ts -->
<!-- evidence: config/vite/zoom-video-assets.mts -->

Estado: preparación local, pendiente de publicación y prueba real. Actualizado: 2026-10-13.

<!-- evidence: electron/main/zoom-protocol.ts -->
<!-- evidence: packages/zoom-runtime/package-lock.json -->
<!-- evidence: scripts/quality/smoke-zoom-runtime.mjs -->
<!-- evidence: openspec/changes/implement-live-studio-runtime/tasks.md -->

El backend vive en el repositorio SofLIA-Learning, rama `codex/live-studio-runtime`. Su migración es `supabase/migrations/20261012193000_live_studio_runtime.sql`; API, dominio, assets y firma están en `apps/web/src/features/live/studio*.ts` y `live-studio*.ts`. El checkout de esta sesión está en `C:/Users/FerSG/Desktop/Soflia/SofLIA-Learning/SofLIA-Learning`. No se aplicó SQL remoto ni se publicó Learning.

## Prueba local de ambos paneles

Ejecutar `npx vite --config test/manual/live-studio-runtime/vite.config.mts`. Abrir `http://127.0.0.1:4321/?actor=instructor` y `http://127.0.0.1:4321/?actor=alumno` en pestañas separadas. La fixture usa el mismo dominio y componentes con identidades explícitas de prueba, estado en memoria y notificaciones SSE. Sirve para probar interacción entre paneles sin credenciales; reiniciar el servidor elimina su estado. Solo escucha loopback y no se incluye en el empaquetado. No reemplaza el backend, RLS ni Realtime Supabase, y rechaza ingreso Zoom real.

## Orden de preparación

1. Revisar y aplicar en staging la migración después de las migraciones existentes de sesiones y aula colaborativa. Crea cuatro tablas privadas, RPC transaccional, RLS de revisiones y bucket privado; no modifica el contrato anterior ni borra datos durante instalación. Verificar publicación `supabase_realtime` de revisiones.
2. Configurar en Learning `ZOOM_MEETING_SDK_CLIENT_ID` y `ZOOM_MEETING_SDK_CLIENT_SECRET` de una app Meeting SDK perteneciente a la cuenta maestra DevOps. Son distintas de las tres credenciales OAuth Server-to-Server que programan reuniones. Conservar las credenciales maestras existentes. Obtener ZAK del anfitrión requiere el permiso correspondiente de la API Zoom. Usar el host vinculado a la sesión, nunca el correo elegido en UI.
3. Publicar el endpoint bearer exacto `/api/auth/live/studio`, su exclusión del filtro de cookies y presupuesto `live-access`. No exponer secretos con prefijo VITE o NEXT_PUBLIC.
4. Construir Hub; `npm run zoom:build` instala el lockfile aislado con `--ignore-scripts`, comprueba tipos y compila assets. `npm run audit:supply-chain` incluye el lockfile SDK. Ejecutar el smoke nativo, luego comprobar ingreso real de instructor y alumno, sin abrir navegador externo.
5. Ejecutar pruebas de chat, moderación, revocación, reconexión, salas académicas, carga de archivos, quizzes, prácticas, reloj y escenas con dos cuentas asignadas. La prueba local SSE no sustituye el ensayo Supabase/Zoom.

Un `401` con `{error:"UNAUTHENTICATED"}` indica que el filtro web intercepta la petición antes de comprobar el bearer del Hub. La ruta studio y su excepción exacta en el proxy deben publicarse juntas. Hub lo presenta como integración no habilitada; un 401 del handler bearer requiere renovar la sesión, mientras que un 403 conserva el diagnóstico de permisos. Abrir sesión en Chrome no sustituye ese contrato de autenticación.

Un 404 con «Sesión no encontrada» procede del handler y revoca el aula/grant previo. Se distingue del 404 de una ruta ausente; este último se presenta como integración no disponible.

No se requieren credenciales SDK por instructor mientras las reuniones pertenezcan a la cuenta Zoom maestra. La firma con rol anfitrión requiere ZAK; una cuenta sin permiso/licencia de webinar no adquiere esa licencia al configurar el SDK. Referencia oficial: [autenticación Meeting SDK](https://developers.zoom.us/docs/meeting-sdk/auth/).

## Diagnóstico del aviso de configuración audiovisual

El mensaje «Falta configurar Meeting SDK en Learning» es una respuesta del
servidor a la operación `zoom` de `POST /api/auth/live/studio`. Hub no lo genera
al comprobar la instalación del paquete ni al conectar Realtime. La petición
precede a la creación del iframe audiovisual: recompilar el SDK del escritorio
no resuelve una firma de ingreso ausente en Learning.

Hub traduce ese diagnóstico a «La conexión audiovisual aún no está configurada
en Learning. El administrador de Soflia debe completar la configuración para
habilitar el ingreso». No oculta el fallo ni presenta la sesión como conectada.

Verificar la versión del backend desplegado antes de configurar el entorno del
servidor. El estudio documentado utiliza `ZOOM_MEETING_SDK_CLIENT_ID` y
`ZOOM_MEETING_SDK_CLIENT_SECRET`; el módulo anterior `zoom.server.ts` de Learning
utiliza `ZOOM_MEETING_SDK_KEY` y `ZOOM_MEETING_SDK_SECRET`. Las credenciales OAuth
que programan reuniones no sustituyen ninguna de esas parejas. No enviar estos
secretos a Hub ni pedir que cada instructor vincule una cuenta.

En la revisión del 14 de octubre de 2026, el checkout disponible en
`C:/Users/fysg5/Desktop/SofLIA/Soflia Learning/SofLIA-Learning` estaba en `main`
y contenía el módulo anterior, sin los archivos del contrato studio ni del panel
de repeticiones descritos en este cambio. Por ello no permite comprobar la
condición exacta del backend que devolvió el aviso ni su configuración desplegada.
La revisión posterior del código remoto de la rama documentada confirmó la
condición exacta: `createZoomStudioJoin` devuelve 503 con ese aviso cuando falta
CLIENT_ID o CLIENT_SECRET, antes de buscar las credenciales de la reunión u
obtener ZAK. Fuente: [firma de ingreso en Learning](https://github.com/DevOps-043/SofLIA-Learning/blob/codex/live-studio-runtime/apps/web/src/features/live/studio-zoom.server.ts).
No se leyeron archivos `.env`, valores de secretos ni se modificó el servidor.
Queda por verificar cuál de esas variables falta en el entorno desplegado y
completar su configuración administrativa; no se declara corregido el ingreso.

## Retención y barreras de rollout

`live_studio_purge`, invocado por el job existente de retención, limpia ledger después de siete días y estado de sesiones cerradas al superar la retención de organización (30 días por defecto). El job reclama hasta 100 archivos por ejecución, borra bytes mediante Storage API y confirma su ledger. Archivos retirados o subidas sin publicar tienen 24 horas de gracia; material de sesiones cerradas sigue la retención de organización. El bloqueo de sesión y el estado purging impiden publicar un archivo reclamado. Si Storage falla se conserva la reclamación para reintento. Programar y verificar el job en staging antes del rollout general.

Quedan por implementar publicación automática desde Engine y correlación/traslado
de salas audiovisuales. La salida continua permite cortes directos entre escenas y pantallas del
curso sobre una pista; no incluye mezcla de audio ni cámara de la llamada en el
programa. La UI identifica salas académicas y medios locales. SofLIA automática
permanece deshabilitada.

## Uso de escenas y salida
### Aula del participante
Los separadores entre paneles permiten cambiar el ancho del chat y repartir la
altura entre transmisión y actividades. Arrastra la línea del medio o enfócala
con Tab y usa las flechas; Home/End llevan a sus límites. Doble clic o Enter
restauran la distribución inicial. Escape cancela un arrastre en curso. El ajuste
no desconecta la transmisión ni cierra actividades, y se conserva durante la
apertura del aula. Al reducir la ventana se acota al espacio disponible. En la
vista móvil se conserva la navegación Clase/Conversaciones y el ajuste de altura;
el separador de ancho se oculta al mostrar un solo panel.

El ingreso no activa micrófono ni cámara. El participante conecta desde el icono
sobre el video, visible al pasar el cursor o enfocar sus controles con el teclado.
En equipos táctiles los iconos permanecen accesibles. No hay botón de ingreso en
el encabezado ni franja fija bajo la transmisión. La barra de participación queda
superpuesta sobre actividades: su asa permite arrastrar o contraer con un clic;
con foco en el asa, las flechas la mueven y Escape la contrae. Contraer no apaga
dispositivos ni abandona la llamada. La posición se limita al área de clase, se
ajusta al redimensionar y se conserva solo mientras el aula sigue abierta.
El margen final desplazable
permite llegar a los botones inferiores. Si el SDK no permite un control, debe utilizar los controles
oficiales indicados por el aviso. CC depende de la configuración real de Zoom;
el botón no habilita transcripción para toda la sesión ni crea una grabación.
Fullscreen requiere una acción del usuario y puede ser rechazado por su entorno.

Durante una llamada Video SDK, Configurar audio muestra dispositivos reportados
por Zoom y permite cambiar micrófono, salida y cámara. Si la fuente está apagada,
la selección se aplicará al activarla; no solicita captura por seleccionar una
opción. Si el equipo se retira o Zoom rechaza el cambio se conserva la selección
anterior. Meeting mantiene la configuración oficial; antes de entrar se conserva
la prueba local de dispositivos.

El chat muestra «Chat en vivo» solo después del evento de suscripción. Ante una
desconexión, Reconectar chat recupera estado, suscripción y presencia. Reintentar
la primera carga usa el mismo flujo. Los mensajes solo desaparecen del editor
tras confirmación y si no se ha escrito un nuevo borrador durante el envío.

En Moderar chat, el instructor ajusta «Espera entre mensajes de participantes» y
pulsa Aplicar: 0 desactiva la espera y 300 es el máximo en segundos. El alumno ve
la cuenta regresiva sin perder el borrador. La regla es por usuario y sesión,
incluye preguntas y solicitud de palabra enviada como mensaje, y no limita al
instructor. Cambiar sala, recargar o salir del historial no borra la marca.

Las reacciones usan un comando propio, seis emojis permitidos, un segundo entre
reacciones y cinco segundos en pantalla. Respetan Permitir reacciones y bloqueo
de acceso; el modo lectura del chat no las deshabilita. No incrementan mensajes
ni estadísticas. Los eventos solo se proyectan a la sala actual del observador.

Este cambio requiere la migración Learning
`20261024180000_live_studio_participation.sql`, preparada y probada localmente.
No se aplicó en remoto. Publicar migración y API de Learning antes del Hub nuevo.
El nuevo HTTP negocia por cabecera `X-Soflia-Studio-Participation: 1`, sin añadir
campos al JSON de la API anterior; sin negociación Learning quita
los campos nuevos para conservar los esquemas estrictos de Hub anteriores. Los
estados antiguos se leen con valores iniciales. El servidor verifica y fecha la
cadencia bajo el mismo bloqueo/CAS de sesión y devuelve 429 sin reintento automático.
El ledger de participación se poda tras cinco minutos al procesar comandos;
no se incluye el ledger ajeno en snapshots, tampoco para instructores.

Actividades abre una zona de trabajo dentro del aula; conserva borradores ante
fallos y recupera la entrega guardada al regresar. Materiales abre los enlaces
firmados disponibles. Salas muestra solo asignaciones propias y el principal;
el cambio académico aún no mueve el audio/video. La solicitud de palabra se comunica como mensaje confirmado. Las reacciones son eventos separados, se muestran cinco segundos sobre el video y no aparecen en el chat.

Soflia individual requiere IA habilitada y consentimiento vigente en Learning,
además de IA configurada en Hub. Un error de política no envía el contenido al
proveedor. No hay activación automática de Soflia en el grupo.

La fixture localhost:4321 ahora incluye escena, práctica, quiz, sala y mensaje
ficticios identificados como ejemplos. Permite ejercitar chat por SSE, entregas,
quiz y presencia entre las dos identidades; no configura Zoom ni autoriza IA.
El ejemplo arranca con cinco segundos entre mensajes para revisar la cuenta
regresiva; el instructor puede cambiarlo desde Moderar chat.
Con esa fixture encendida, `node test/manual/live-studio-runtime/smoke.mjs`
comprueba SSE, chat bidireccional, deduplicación, moderación, sala asignada,
entrega, quiz y lectura de un material subido. Restaura moderación/quiz y retira
el material; mensajes, respuestas y entrega de prueba permanecen hasta reiniciar
el servidor. Solo acepta el destino fijo localhost:4321 y no usa credenciales.

### Producción del instructor
El instructor puede arrastrar las divisiones laterales para ampliar chat,
transmisión o actividades, y la división sobre Escenas para repartir su altura
con la vista previa. Se aplican los mismos controles de teclado y restauración.
Son preferencias visuales locales en memoria; no cambian la composición enviada
al grupo ni reinician cámara, audio, iframe o programa continuo.

1. Añade contenido con + en el dock Escenas. Nueva escena conserva láminas,
   archivos, fuentes autorizadas y pantallas del curso con reloj opcional.
2. Selecciona una fila y pulsa Activar salida junto a los modos de vista previa.
   No inicia la llamada ni comparte sin consentimiento. Si compartías una fuente
   directa, detén esa captura primero.
3. Entra a la llamada y pulsa su control oficial Compartir para emitir la salida
   continua. Chats y paneles del Hub no forman parte de esa fuente.
4. Con la salida activa, pulsa otra escena: cambia directamente mediante corte
   y conserva la pista compartida. Si la fuente falla permanece la anterior.
5. Cerrar salida vuelve a la vista local. No silencia el micrófono ni apaga la
   cámara. El vínculo de pantalla se puede cambiar después de cerrar la salida.

El estudio usa un único monitor y un dock compacto de Escenas a todo el ancho. Los controles de medios están en la barra inferior. La
lista de cuatro escenas queda visible a 1280×720; listas más largas se desplazan
dentro de su dock. No se muestran controles de transiciones, segundo monitor ni
avisos de pantalla preparada. Los modos pantalla/cámara/combinada son locales;
se deshabilitan cuando el monitor muestra el programa continuo.

La preparación es local al estudio y no persiste al salir. No se publica nada
en Learning por seleccionar una pantalla. `node scripts/quality/smoke-studio-program.mjs`
comprueba composición, transporte local, captura del programa, pista estable y
aislamiento sin credenciales ni una reunión real. El ensayo de dos cuentas sigue
dependiendo de la configuración administrativa descrita arriba.

El tipo de dato limita 500 presencias; no hay evidencia de carga para esa capacidad. El lease no genera invalidación cuando solo cambia su fecha, y se debe ensayar tráfico agregado, rate limit y tamaño de estado en staging antes de abrir grupos grandes.

Rollback operativo: volver al Hub anterior y retirar la ruta studio del despliegue Learning, conservando tablas/bucket para recuperación. No ejecutar DROP ni purgar Storage como rollback. Para volver a activar, restaurar endpoint y cliente compatibles con la misma versión de contrato.

La autorización humana es necesaria antes de aplicar migración remota o modificar permisos/secretos de producción. Ningún archivo local `.env` ni secreto se modificó en esta fase.


## Entrada con API anterior de Learning
El envío de participation_version dentro del cuerpo fue una regresión: las APIs
anteriores usan un esquema estricto y rechazan campos desconocidos antes de cargar
el aula. Hub ahora conserva organization_slug/session_id/operation en el JSON y
negocia solo mediante la cabecera X-Soflia-Studio-Participation. La API anterior
ignora la cabecera y conserva el acceso normal. Learning nuevo confirma capacidad
en el snapshot; sin ella no se ofrecen los comandos de participación nuevos.
No se cambian validaciones de identidad o membresía ni se reintenta un 403 con
otro formato o rol. Este arreglo del Hub no requiere desplegar el backend nuevo
para volver a entrar al aula anterior. Reiniciar la aplicación si su proceso main
no está observando cambios; solo recargar el renderer no actualiza el HTTP main.
