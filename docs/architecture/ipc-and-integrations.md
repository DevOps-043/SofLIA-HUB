# IPC e integraciones externas

Estado: vigente. Actualizado: 2026-08-04.

<!-- evidence: electron/preload/channels.ts -->
<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/service-ipc.ts -->

## Contrato IPC

La allowlist actual contiene 309 canales derivados de cinco arrays: 72, 59, 65,
102 y 11. El numero es verificable en `electron/preload/channel-group-*.ts`; si cambia,
el catalogo y su validador deben actualizarse juntos.

| Namespace | Canales | Proposito |
|---|---:|---|
| `computer` | 33 | archivos, comandos, procesos, portapapeles, email, tema/sidebar |
| `desktop-agent` | 23 | tareas, abort, config, UI input, ventanas, screenshot, calibracion |
| `calendar` | 17 | OAuth, conexiones, eventos, polling y eventos de trabajo |
| `sdo` | 16 | decisiones, claims, acciones, aprobacion, audit y artifacts |
| `memory` | 14 | contexto, facts y skills |
| `orb` | 15 | dictado, TTS, apertura y ventana flotante |
| `monitoring`, `gmail`, `remote-node` | 13 cada uno | actividad; correo; host remoto |
| `meeting`, `whatsapp` | 12 cada uno | runs/approvals/sync; conexion/config/status |
| `meeting-live` | 11 | audio, segmentos, deteccion y estado live |
| `channels`, `workflow-hub` | 10 cada uno | hub multicanal y casos de workflow |
| `integrated-browser` | 33 | navegación, pestañas, composición, captura visible, percepción, controlador determinista, viewport, visibilidad, eventos, historial, credenciales y extensiones |
| otros | 60 | voice, updater, automation, drive, pytools, telegram, gchat, app, proactive, background-host, root y AI |

### Recorrido obligatorio

1. El renderer llama un wrapper de `src/services` o una API `window.*` tipada.
2. `electron/preload/*-apis.ts` usa `safeInvoke`, `safeSend` o `safeOn`.
3. `safe-ipc.ts` valida canal y sanitiza cada argumento.
4. Un `*-handlers.ts` registra `ipcMain.handle/on`, valida el payload y llama al
   servicio de dominio.
5. El handler devuelve un objeto serializable; nunca retorna clases Electron,
   callbacks, streams vivos o tokens.

Agregar solo una cadena al array no implementa una capacidad. Un cambio IPC debe
actualizar las cuatro capas, tipos y pruebas segun
[el estandar](../standards/electron-ipc.md).

## Seguridad preload

- Canal desconocido: error `Unauthorized IPC channel` antes de invocar.
- Funciones/callbacks en payload: rechazo.
- Claves de prototype pollution: descartadas.
- Limites: profundidad 20, array 1000, objeto 200 claves.
- CSP se inyecta desde `electron/preload/security.ts`.
- Las ventanas principal y orbe usan sandbox, context isolation y Node off.
- El contenido del navegador integrado usa otra `WebContentsView` sin preload,
  con sandbox, context isolation, Node off y particion persistente propia. Sus
  canales solo existen en el renderer principal y el handler verifica el emisor.

### Contrato del navegador integrado

`electron/integrated-browser-handlers.ts` registra treinta y una operaciones invocables:
diecisiete de estado/navegacion/pestañas/composición/viewport/captura/percepción/visibilidad,
tres del controlador determinista, dos de historial, cuatro de credenciales y
cinco de extensiones. Dos canales adicionales entregan estado y solicitudes de
apertura del agente al renderer. `electron/preload/integrated-browser-api.ts` y
`src/services/integrated-browser-service.ts` son las capas publicas.

Los payloads de URL admiten HTTP(S), `about:blank` y busqueda normalizada; los
bounds son enteros y se ajustan al contenido de la ventana. Un emisor distinto
del renderer principal recibe `sender_denied`. El renderer nunca recibe el
secreto descifrado ni una ruta de extension; esas operaciones se resuelven en
main y no forman parte del catalogo de herramientas del agente. La instalacion
separa inspeccion y confirmacion: main emite metadata y un token efimero, y solo
copia o carga al recibir la confirmacion renderer. La captura de
solo lectura exige un viewport visible. La percepción pasiva conserva una
captura visual reducida a 1024 px en su lado mayor y codificada en JPEG, con
cadencia base de diez segundos, y la difiere cuatro segundos después de
interacción, navegación o resize sin ejecutar DOM. En YouTube la cadencia es de
treinta segundos y la calma de doce para dejar terminar transcripciones y
paneles asíncronos. Solo un turno clasificado como dependiente del navegador
obtiene una revisión vigente y el
DOM saneado bajo demanda. Solo el último snapshot queda en memoria, Computer Use
no compite con el temporizador pasivo y el refresco nunca invoca al modelo.
Los turnos contextuales solicitan un snapshot puntual reciente: referencias a
personas, mensajes o recursos visibles se resuelven aunque no contengan un verbo
de visión. Los canales `integrated-browser:element-click`,
`integrated-browser:element-type` e `integrated-browser:scroll` exponen el
controlador determinista: actúan por la referencia del último snapshot, resuelven
el elemento vivo antes de enviar entrada real y se rechazan sin pestaña visible o
mientras Computer Use controla la vista.
Una secuencia híbrida puede usar Computer Use desktop para una aplicación
externa y volver a estos canales para la pestaña integrada; la superficie se
declara por paso, no existe fallback silencioso y los efectos externos conservan
confirmación HITL.
`integrated-browser:set-observation-enabled` permite pausar y descartar esa
evidencia. El DOM omite valores de formularios, contenido editable, contraseñas
y credenciales de URL, y se entrega como contenido de página no confiable.

Main administra hasta 500 pestañas lógicas dentro de la misma partición
persistente y conserva como máximo ocho `WebContentsView` vivas mediante LRU.
Los popups HTTP(S) se convierten en pestañas internas. Los canales
`integrated-browser:tab-detach` y `integrated-browser:tab-reattach` permiten al
renderer principal mover una pestaña validada a una de hasta cuatro
`BaseWindow`, siempre dentro del mismo presupuesto y sesión. Una composición puede mantener una vista única,
dos mitades o una secundaria superpuesta. El foco determina `activeTabId`, que
es el único destino de navegación, captura, autofill y Computer Use.

`orb:show` permite al renderer principal autenticado abrir o enfocar la Orbe
general. El canal no expone primitivas de ventana y rechaza otro emisor.

El panel de chat no mueve la capa nativa fuera de pantalla ni compone la página
mediante polling de capturas. El renderer publica bounds con inset izquierdo o derecho y la vista
permanece viva. Solo los gestores flotantes toman una captura puntual y llaman a
`hide`; al cerrarlos republican el viewport. Una tarea dirigida a esta vista
falla cerrado y nunca cambia silenciosamente al backend desktop.

## Integraciones y propietarios

| Integracion | Cliente/servicio | Configuracion | Patrón de fallo |
|---|---|---|---|
| Gemini | dos SDK + REST/Live WebSocket | `VITE_GEMINI_API_KEY`, modelos en `src/config.ts` | fallback de modelo, timeout, error publico |
| Supabase Lia | renderer + main por dominio | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | diagnostico/degradado Lia |
| Supabase SOFIA | renderer auth/org | `VITE_SOFIA_SUPABASE_*` | bloquea auth principal si no configura |
| Supabase IRIS | renderer/main proyecto | `VITE_IRIS_SUPABASE_*` | Project Hub degradado |
| Google OAuth/APIs | Calendar auth compartido | `VITE_GOOGLE_OAUTH_CLIENT_ID/SECRET` | conexion por usuario, refresh y desconexion |
| Microsoft Calendar | MSAL/Graph | `VITE_MICROSOFT_CLIENT_ID` | conexion separada por provider |
| Google Cloud TTS | REST desde orbe | API key, voice y language `VITE_*` | fallback/estado de voz |
| WhatsApp | Baileys WebSocket | QR + config en `userData` | reconnect/status; allowlists |
| Telegram | Bot API | config cifrada/estado local del servicio | test de conexion y status |
| Gamma | API de presentaciones | `VITE_GAMMA_API_KEY` | workflow queda en error sin artifact |
| SMTP | Nodemailer | configurado via handlers computer | confirmacion de envio y error seguro |
| GitHub Releases | electron-updater/Actions | repo publico de releases + token solo CI | check/download/install por estado |
| Home Assistant | toolset dinamico builtin | URL/token provistos al instalar | doctor, contrato, timeout y HITL write |
| Nodos remotos | servicio propio de host/node | config en `userData` | status/test y capability de canal |

## Limites de contrato

- Variables `VITE_` quedan incrustadas por Vite incluso para main; no deben
  considerarse secretos de backend. Las claves anon publicas de Supabase dependen
  de RLS; credenciales privilegiadas no deben usar este mecanismo.
- OAuth tokens no se documentan ni se envian al renderer salvo metadata segura.
- No existe garantia de disponibilidad de terceros; cada UI debe soportar no
  configurado, desconectado, rate limit y timeout.
- `docs/contracts/openapi.json` no enumera IPC y no debe usarse como allowlist.
