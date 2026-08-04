# IPC e integraciones externas

Estado: vigente. Actualizado: 2026-08-04.

<!-- evidence: electron/preload/channels.ts -->
<!-- evidence: electron/preload/safe-ipc.ts -->
<!-- evidence: electron/main/service-ipc.ts -->

## Contrato IPC

La allowlist actual contiene 285 canales derivados de cuatro arrays: 72, 59, 65
y 89. El numero es verificable en `electron/preload/channel-group-*.ts`; si cambia,
el catalogo y su validador deben actualizarse juntos.

| Namespace | Canales | Proposito |
|---|---:|---|
| `computer` | 33 | archivos, comandos, procesos, portapapeles, email, tema/sidebar |
| `desktop-agent` | 23 | tareas, abort, config, UI input, ventanas, screenshot, calibracion |
| `calendar` | 17 | OAuth, conexiones, eventos, polling y eventos de trabajo |
| `sdo` | 16 | decisiones, claims, acciones, aprobacion, audit y artifacts |
| `memory`, `orb` | 14 cada uno | contexto/facts/skills; dictado/TTS/ventana flotante |
| `monitoring`, `gmail`, `remote-node` | 13 cada uno | actividad; correo; host remoto |
| `meeting`, `whatsapp` | 12 cada uno | runs/approvals/sync; conexion/config/status |
| `meeting-live` | 11 | audio, segmentos, deteccion y estado live |
| `channels`, `workflow-hub` | 10 cada uno | hub multicanal y casos de workflow |
| `integrated-browser` | 12 | estado, navegacion, viewport, visibilidad y eventos main-renderer |
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

`electron/integrated-browser-handlers.ts` registra diez operaciones invocables:
estado, apertura, navegacion, atras, adelante, recarga, detener, foco, viewport y
ocultar. Dos canales adicionales entregan estado y solicitudes de apertura del
agente al renderer. `electron/preload/integrated-browser-api.ts` y
`src/services/integrated-browser-service.ts` son las capas publicas.

Los payloads de URL admiten HTTP(S), `about:blank` y busqueda normalizada; los
bounds son enteros y se ajustan al contenido de la ventana. Un emisor distinto
del renderer principal recibe `sender_denied`.

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
