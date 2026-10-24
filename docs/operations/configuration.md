# Configuracion, secretos y estado local

Estado: vigente. Actualizado: 2026-10-22.

No se leen ni documentan valores de `.env`. Esta pagina registra solo nombres,
consumidores y comportamiento cuando faltan.

<!-- evidence: src/config.ts -->
<!-- evidence: config/vite/env-defines.mts -->
<!-- evidence: electron/main/environment.ts -->

## Variables de build/runtime

El envío Gmail no agrega variables. Las cuotas de destinatarios/adjuntos y los
estados de cancelación o envío incierto están en el [contrato de envío](../architecture/ipc-and-integrations.md#envío-gmail).
Si falla preparar un adjunto, corregirlo antes de repetir; no se envía una copia
incompleta. Si el resultado es incierto, revisar Enviados en Gmail antes de volver
a solicitarlo. No se debe activar retry automático sobre esa respuesta.

| Variable | Consumidor | Necesidad/ausencia | Sensibilidad |
|---|---|---|---|
| `VITE_GEMINI_API_KEY` | chat, WhatsApp, meetings, memoria, vision | IA queda no configurada o usa key guardada de WhatsApp en rutas compatibles | secreta, pero prefijo Vite puede exponerla al bundle |
| `VITE_WHATSAPP_GEMINI_MODEL` | configuracion del agente WA | override opcional; defaults en codigo | no secreta |
| `VITE_SUPABASE_URL` | Lia renderer/main | chat/Hub degradados sin URL valida | publica |
| `VITE_SUPABASE_ANON_KEY` | Lia renderer/main | cliente no se configura | publica condicionada a RLS |
| `VITE_SOFIA_SUPABASE_URL` | auth SOFIA | auth principal no disponible | publica |
| `VITE_SOFIA_SUPABASE_ANON_KEY` | auth SOFIA | auth principal no disponible | publica condicionada a RLS |
| `VITE_IRIS_SUPABASE_URL` | Project Hub/IRIS tools y origen permitido de archivos main | sin origen HTTPS válido (o loopback explícito), no se preparan subidas ni copias locales; nunca se adopta el host de la respuesta firmada | publica |
| `VITE_IRIS_SUPABASE_ANON_KEY` | Project Hub/IRIS tools | IRIS degradado | publica condicionada a RLS |
| `VITE_SOFLIA_LEARNING_SUPABASE_URL` | servicio Learning | servicio no disponible | publica |
| `VITE_SOFLIA_LEARNING_SUPABASE_ANON_KEY` | servicio Learning | servicio no disponible | publica condicionada a RLS |
| `VITE_LEARNING_BASE_URL` | inicio de sesion federado con SofLIA Learning | la entrada federada no se ofrece; el inicio por contrasena no cambia | publica |
| `VITE_LEARNING_SSO_ENABLED` | interruptor de la entrada federada | ausente o distinto de `true`, la entrada no se monta y los retornos del flujo se ignoran | no secreta; es la bandera de rollback del cambio |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Calendar/Workspace OAuth | no se puede conectar Google | identificador publico |
| `VITE_GOOGLE_OAUTH_CLIENT_SECRET` | OAuth desktop | conexion falla | secreto; riesgo de bundle por `VITE_` |
| `VITE_MICROSOFT_CLIENT_ID` | Microsoft Calendar | no se puede conectar | identificador publico |
| `ELEVENLABS_API_KEY` | Orbe y modo lectura, solo Electron main | la Orbe conserva texto sin voz; el lector visual funciona sin narración | secreta; no llega a renderer/preload, pero una app Electron distribuida no sustituye un proxy secreto |
| `ELEVENLABS_VOICE_ID` | Orbe y modo lectura, solo Electron main | narración no disponible | identificador no secreto; la voz debe estar disponible en el mismo workspace de la clave |
| `ELEVENLABS_MODEL_ID` | Orbe y modo lectura, solo Electron main | default `eleven_turbo_v2_5` | no secreta |
| `ELEVENLABS_OUTPUT_FORMAT` | Orbe y modo lectura, solo Electron main | default `mp3_44100_128` | no secreta |
| `VOICE_CALL_ENABLED` | modo llamada en WhatsApp y Telegram | ausente o vacía, el modo llamada sigue habilitado: es una capacidad del producto, no una prueba que haya que encender. Solo `false`, `0`, `no` u `off` lo apagan, y ese apagado es el rollback | no secreta |
| `VOICE_CALL_IDLE_TIMEOUT_MS` | vencimiento por inactividad de una llamada | default 10 min; se acota al rango 1–60 min | no secreta |
| `VOICE_CALL_VOICE_ID` | voz propia del modo llamada | vacía o con formato inválido, usa `ELEVENLABS_VOICE_ID` | identificador no secreto; misma restricción de workspace |
| `VITE_SKILL_PRESENTACIONES_ENABLED` | **apagado local de emergencia** de la Skill de presentaciones | ausente o vacía, la Skill sigue disponible: es una capacidad publicada y no puede depender de que el runner declare la variable. Solo `false` o `0` la retiran, y ese apagado manda sobre el catálogo de la base de datos | no secreta; es el rollback que no depende de que Supabase responda |
| `SOFLIA_BROWSER_CDP_DOM` | backend de `read_browser_dom` en el navegador integrado | ausente o distinta de `1`, el agente lee el DOM recorriendo la página en JavaScript, con presupuesto de 400 ms y tope de 1800 nodos. Con `1` usa `DOMSnapshot.captureSnapshot`, que Blink resuelve fuera del hilo del renderer y sin esos topes; si la sesión de inspección no está disponible cae al recorrido en script, así que quitar la variable es el rollback | no secreta |
| `SOFLIA_BROWSER_SOM` | Set-of-Marks del navegador para Computer Use | ausente o distinta de `1`, la captura llega limpia y el modelo estima píxeles. Con `1` se dibujan cajas numeradas sobre los controles que ya devuelve `read_browser_dom`. Es opt-in a propósito: permite medir con el mismo binario si las marcas reducen pasos y clics fallidos. Ante cualquier fallo del dibujado se entrega la captura limpia, y quitar la variable es el rollback | no secreta |
| `VITE_DEV_SERVER_URL` | bootstrap dev | usa renderer build si falta | no secreta, gestionada por Vite |
| `VITE_PUBLIC` | paths de recursos | calculada por main | no configurar manualmente |

`ELEVENLABS_OUTPUT_FORMAT` define el transporte que el reproductor decodifica;
no habilita una descarga de archivo. El modo lectura no expone canal ni botón de
guardado. El modo llamada ignora esa variable y pide siempre `opus_48000_64`
(OGG): es el único formato que WhatsApp presenta como nota de voz y Telegram
como `voice`, y pedirlo ya codificado evita empaquetar ffmpeg. Una voz encontrada en el catálogo público debe agregarse primero al
workspace asociado con `ELEVENLABS_API_KEY`; una búsqueda en “Explorar” no
garantiza acceso mediante API.

## Archivos `userData`

| Archivo/directorio | Productor | Contenido |
|---|---|---|
| `soflia-memory.db` | MemoryService | conversacion/resumen/embeddings/facts y memoria aprendida (tabla `skills`, distinta del catalogo de Skills invocables) |
| `thoughts.db` | ThoughtLogger | eventos por task/agent |
| `knowledge/` | Knowledge/PathMemory | MEMORY, users, daily y PATHS |
| `desktop-agent-config.json` | Desktop Agent | engine, modelos, captura, limites, UIA/OCR |
| `scheduler-state.json` | TaskScheduler | cron, prompt, owner/telefono, last run |
| `communication-hub-state.json` | Communication Hub | policy, identity bindings, prefs, audit, scheduled |
| estados de workflow/automation | services respectivos | templates, runs, cases y reglas |
| auth WhatsApp | WhatsAppService/Baileys | credenciales de sesion |
| screenshots monitoring | MonitoringService | PNG/JPEG retenidas si habilita |
| `skill-workspaces/` | SkillWorkspaceService | `workspaces.json` (indice) y una carpeta por entregable bajo `presentaciones/<id>/`. Limites por skill: 512 KB por archivo, 8 MB y 60 archivos por workspace. El usuario puede abrirla y borrarla desde el panel. |

Los nombres exactos adicionales se resuelven en cada servicio con
`app.getPath('userData')`. No deben codificarse rutas absolutas del equipo.

## Secretos de funciones backend

`sofia-session-exchange`, desplegada en Lia, requiere `SOFIA_SUPABASE_URL` y
`SOFIA_SUPABASE_ANON_KEY` en el gestor de secretos de funciones. La URL y clave
administrativa Lia son provistas por el entorno Supabase. Ninguna se declara con
prefijo `VITE_`, se copia a Electron o se versiona con valores.

La función acepta un JWT emitido por otro proyecto, por lo que desactiva la
validación del gateway Lia y autentica explícitamente contra SOFIA dentro del
handler. Desactivar el gateway sin esa validación interna es una configuración
insegura y no autorizada.

## Inicio de sesión federado con SofLIA Learning

El Hub no implementa el SSO de Google ni de Microsoft: lo delega en Learning, que
ya lo ejecuta con sus propias credenciales. En el Hub solo se configuran
`VITE_LEARNING_BASE_URL` y `VITE_LEARNING_SSO_ENABLED`; **ninguna clave del
proveedor de identidad debe llegar a este repositorio**, porque toda variable con
prefijo `VITE_` viaja en claro dentro del bundle distribuido.

Del lado de Learning hace falta la migración `desktop-sso-tickets` aplicada en el
proyecto SOFIA. El intercambio usa su cliente administrativo existente, así que
no introduce secretos nuevos.

Orden de despliegue obligatorio: migración y Learning primero, luego el Hub con
`VITE_LEARNING_SSO_ENABLED` sin definir, y encender el interruptor solo tras
verificar el flujo contra el despliegue. La reversión es apagarlo, lo que
devuelve el inicio por contraseña como única vía sin publicar versión.

## Carga de entorno

Vite `loadEnv` carga el prefijo público `VITE_`; además, la configuración de
build carga `ELEVENLABS_*` en un conjunto main-only. El primer conjunto se
define en main y preload; el segundo solo en main y nunca queda disponible en
`import.meta.env`. En desarrollo, `electron/main/environment.ts` intenta `.env`
relativo al bundle y establece `APP_ROOT`, `VITE_DEV_SERVER_URL` y `VITE_PUBLIC`.
La app empaquetada no incluye `.env`; el workflow de release crea uno temporal
desde GitHub Secrets antes del build.

El workflow también escribe en Windows, macOS y Linux los interruptores públicos
`VITE_MULTIMODAL_BROWSER_VISION`, `VITE_MULTIMODAL_MEDIA_ATTACHMENTS` y
`VITE_MULTIMODAL_AMBIENT_AUDIO`. Se obtienen de GitHub Actions Variables y usan
`true` cuando no hay un valor configurado, conservando el valor por omisión del
runtime. Para desactivar una capacidad se configura la cadena `false` en su
variable de repositorio; no requiere crear secretos. Esto no conecta por sí solo
las funciones de audio y adjuntos que todavía carecen de un consumidor de UI.

Main y preload no reciben `import.meta.env`: `config/vite/env-defines.mts`
sustituye la expresión literal `process.env.VITE_*` por su valor al compilar. La
sustitución es textual, así que el código de `electron/` debe **nombrar la
variable como expresión literal** al menos una vez. Leerla a través de un objeto
(`env.VITE_ALGO`, `env[nombre]`) esquiva la sustitución y en la aplicación
instalada devuelve vacío, porque ahí `process.env` sólo trae el entorno del
sistema operativo. `scripts/quality/check-release-env.mjs` verifica esa forma de
lectura; la excepción declarada es `electron/soflia-learning/config.ts`, que
carga su `.env` en ejecución con dotenv y admite configuración local cifrada.

## Llamadas directas de Google Chat deshabilitadas

No existe una variable de entorno ni una opción de runtime para activar la
automatización de llamadas directas. Si Gmail o Google Chat intenta abrir o
navegar a la ruta exacta `https://meet.google.com/call`, main cancela la acción
sin crear pestañas, ventanas, reuniones alternativas ni procesos externos. La
protección también alcanza ventanas anidadas, `about:blank -> /call`,
redirecciones y subframes.

El navegador no observa `CreateMediaSession`, `CreateMeetingDevice` o
`CreateMeetingInvite`, no modifica SDP y no fuerza field trials para esa ruta.
La gobernanza general de cámara, micrófono, pantalla y notificaciones permanece
activa por sitio. Los enlaces HTTP(S) normales que el usuario abre de forma
consciente siguen funcionando como navegación ordinaria.

Después de actualizar esta lógica se debe reiniciar por completo Electron para
recargar main. Una señal automática bloqueada produce únicamente el mensaje
`[Navegador][Seguridad] Llamada directa automática de Google Chat bloqueada.`;
no debe aparecer una pestaña o ventana nueva.

## Operacion segura

- Nunca usar service role Supabase en `VITE_*`.
- No renombrar `ELEVENLABS_API_KEY` con prefijo `VITE_`: eso la expondría al
  entorno público del renderer. Para una frontera de secreto fuerte en clientes
  distribuidos, enrutar la síntesis mediante un backend autenticado.
- La clave restringida sólo necesita **De texto a voz: Acceso** cuando el
  `ELEVENLABS_VOICE_ID` y el modelo ya están configurados. No necesita voz a
  voz, STT, administración, escritura de voces ni acceso a modelos.
- Rotar una key comprometida en el proveedor y reconstruir releases que la
  hayan incrustado.
- No versionar `.env*`, JSON de `userData`, QR, tokens ni screenshots.
- Al reportar config, mostrar `configured: true/false`, provider y expiry; no valor.
- Cambiar defaults persistentes requiere migrar JSON previo o mantener fallback de
  compatibilidad, como `captureStrategy` de Desktop Agent.

## Custodia del calendario

La sesión del Hub elige el propietario de las conexiones Workspace. Sólo se
restauran conexiones con propietario exacto; cerrar sesión limpia la memoria y
detiene el calendario automático. Debe activarse de nuevo al entrar con otra cuenta.

Las nuevas credenciales se cifran con safeStorage asíncrono del SO en
`calendar-credentials/<hash del usuario>.bin` bajo userData. No hay respaldo plano.
En Linux se exige un llavero seguro y se rechazan basic_text/unknown; si no hay
custodia disponible, conectar falla con un mensaje público para habilitar el
llavero. Archivo ilegible, propietario incorrecto o fallo de disco se rechazan
sin sobrescribir la versión anterior ni exponer contenido en errores.

La primera operación autenticada sella calendar-connections.json en la misma
ruta, conservando sus registros cifrados. No se elimina el archivo ni se asigna
un dueño a conexiones huérfanas: esas cuentas deben reconectarse por OAuth.
Los archivos privados vacíos impiden reimportación después de desconectar. No
convertir el archivo cifrado de vuelta a JSON para un downgrade; una versión
anterior deberá reconectar. Un legado inválido/excesivo se conserva intacto y
requiere recuperación explícita antes de completar su migración.

Verificación opt-in en Windows: `npm run calendar:smoke:native` usa el Electron
instalado y tres procesos con perfil temporal y credenciales ficticias. No abre
el Hub ni lee .env o perfiles reales. Los resultados y límites viven en el
[cambio de custodia](../../openspec/changes/secure-calendar-credentials/proposal.md).

## Planes privados de Gmail

Los planes nuevos viven bajo userData en
`gmail-private-plans/<sha256 de usuario y cuenta>/<gmail-plan-UUID>.bin`, cifrados
con el llavero del SO. No editar el binario ni convertirlo a JSON para un
downgrade. Sin llavero seguro se rechaza la persistencia; Linux rechaza
basic_text/unknown. Un archivo corrupto o de otro propietario bloquea su lectura.
La selección del último plan falla ante archivos ilegibles o fechas ambiguas;
se puede indicar un ID concreto válido de la cuenta.

El directorio heredado `gmail-organization-plans` se conserva intacto y no se
importa ni adjudica a la cuenta activa. Para continuar se debe generar una vista
previa nueva. El legado puede contener información sin cifrar; su retirada es
una operación explícita separada, con respaldo y autorización.

Hay cuota de 100 planes por cuenta, 2 MiB por JSON y 4 MiB por archivo cifrado.
No se elimina historial automáticamente al alcanzar la cuota. Conservar un
respaldo y gestionar una limpieza autorizada del historial antes de crear otro
plan; reducir mensajes si el plan excede tamaño. No retirar un registro pendiente
como forma de reintentar: revisar primero en Gmail las etiquetas y los mensajes
afectados. Una intención pendiente marca resultado incierto y bloquea apply/undo
automáticos. La reversión con cambios confirmados y sin intención pendiente
puede continuarse con nueva aprobación; un conflicto con cambios manuales exige
reconciliación humana. No se ofrece reparación automática de diarios.

`npm run calendar:smoke:native` comprueba además planes Gmail con DPAPI real:
persistencia/restauración, aislamiento de cuenta y conservación de un checkpoint
pendiente entre tres procesos. Usa sólo perfil temporal y datos ficticios.

## Operaciones directas de Gmail

Lecturas, etiquetas y papelera conservan las APIs existentes; las escrituras
desde Hub/Orbe presentan confirmación nativa de cuenta y alcance. El proceso
prepara todas las páginas antes de modificar. Si las opciones conservan la
etiqueta origen, sólo se modifica el snapshot una vez; no se vuelve a vaciar
indefinidamente la misma página. Nuevos mensajes quedan fuera y pueden impedir
el borrado posterior. Referencias inválidas/ambiguas o cuotas excesivas se
rechazan antes del primer efecto.

Tras un fallo, revisar `processed`, `effectsConfirmed`, etiquetas creadas y los
flags partial/uncertain/recoveryRequired. No interpretar `remaining` indefinido
como cero ni `remainingLabelsVerified:false` como una lista remota actualizada.
El ID efímero de operación enlaza fallos con logs saneados. Revisar en Gmail los
cambios ya confirmados antes de repetir; no hay retry ni rollback automáticos.
Este progreso se mantiene durante la llamada y se pierde al cerrar el proceso;
el diario recuperable pertenece únicamente al flujo de planes. No intentar
reanudar una operación directa mediante archivos del store de planes.

Las cuotas y presupuestos están en
[parámetros runtime](../architecture/runtime-parameters.md#operaciones-directas-de-gmail).
Sin nuevas variables, archivos de configuración, credenciales o permisos.

## Historial operativo de herramientas WhatsApp

Los eventos `kind:tool` nuevos de `whatsapp-conversation-history.jsonl` conservan
observación mínima: estado/flags/conteos, nombres de herramientas identificadores,
referencia UUID y duración. Ya no guardan el JSON de argumentos, mensajes ni
errores libres. Para diagnosticar una excepción del dispatcher, buscar su
correlationId en el registro saneado; el mismo código/ref se mantiene en el
resultado. No usar una correlación nueva como prueba de avance o de ejecución.

Las consultas de historial proyectan también eventos tool antiguos sin
reescribirlos. Un respaldo antiguo puede seguir conteniendo argumentos y PII
en sus bytes. Su retirada/cifrado requiere una operación aparte; no eliminar el
archivo ni atribuirle cifrado por este cambio. Texto conversacional, teléfonos
y otros eventos siguen bajo las políticas existentes. No hay variables nuevas.

## Producción audiovisual local

La configuración separada `.env.audiovisual.local` contiene la bandera pública y rutas locales de FFmpeg/FFprobe, sin credenciales. Se genera con `npm run audiovisual:setup`; consultar [contrato y preparación](../architecture/presentation-audiovisual-production.md#entorno-y-preparación).

El `.env` principal local también admite `VITE_SKILL_AUDIOVISUAL_ENABLED`,
`SOFLIA_FFMPEG_PATH` y `SOFLIA_FFPROBE_PATH`; tiene prioridad sobre el respaldo
separado. Las dos rutas son absolutas y exclusivas de main; se entrecomillan
cuando contienen espacios. Activar la bandera local exige disponer del motor
verificado. Esto no cambia el apagado por omisión del workflow de release,
que conserva esa política hasta distribuir el motor multiplataforma.

## Autorización de micrófono local

`voice-passive.json` conserva preferencias de máquina, pero `enabled` no abre
micrófono al arrancar. Tras autenticar, revisa la configuración en el diálogo
nativo o usa **Autorizar voz en esta sesión** en ajustes. Cancelar mantiene
inactiva la escucha. **Detener captura de voz** cancela también intención
pendiente; puede interrumpir transcripción Meeting Live al parar el proceso
compartido, con aviso visible. Una descarga ya autorizada puede continuar:
no se promete rollback ni se repite automáticamente. Ver
[contrato y recuperación](../security/local-voice-authorization.md).
`npm run voice:smoke:native` verifica IPC aislado con servicios y diálogos
simulados, sin abrir dispositivos ni instalar modelos.

## Privacidad documental

La preferencia de máquina de ajustes se guarda en `privacy-config.json`.
Un fallo de carga no equivale a protección desactivada; un fallo de escritura
requiere releer antes de afirmar su estado. Desactivar exige revisión nativa.
Python puede faltar al guardar protección, pero la lectura protegida se deniega.
`npm run python-tools:smoke:native` comprueba el puente con perfil temporal,
servicio/diálogos simulados y documentos ficticios. Cuotas, límites por patrones
y temporales pendientes: [contrato documental](../security/python-document-boundary.md).
