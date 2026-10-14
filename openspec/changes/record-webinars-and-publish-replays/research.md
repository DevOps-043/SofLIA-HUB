# Investigación de grabación de webinars

Estado: investigación, sin configuración remota ni implementación. Consulta: 2026-10-13.

## Conclusión

Zoom puede encargarse de grabar automáticamente. La propuesta es utilizar su
grabación en nube y construir en Soflia recepción, archivo privado, supervisión y
publicación controlada. Esto encaja con Meeting SDK y evita que capturar dependa
del portátil, las fuentes locales o la conexión de Hub.
Capacidad documentada no equivale a capacidad comprobada de la cuenta conectada.

## Comparación

| Servicio | Automatización documentada | Destino y publicación | Implicación para Soflia |
| --- | --- | --- | --- |
| Zoom | Grabación automática de reuniones/webinars, con opciones de ordenador o nube. La del ordenador requiere cliente de escritorio Zoom; la nube tiene requisitos de licencia/configuración. | Archivos de Zoom Cloud; eventos y API permiten recuperarlos. | Proveedor principal recomendado; verificar cuenta/host antes del rollout. |
| Meet | El anfitrión puede programar grabación automática; comienza al entrar host/co-host en web, con edición elegible y habilitación administrativa. | Drive del organizador; disponibilidad y compartición regidas por Workspace. | Referencia funcional, sin añadir otra integración ahora. |
| Teams | Webinars graban automáticamente por defecto; grabación y publicación son acciones separadas. | OneDrive/SharePoint; publicación posterior a asistentes. | Patrón de producto útil para distinguir archivo privado y repetición publicada. |

Fuentes: [Zoom automático](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067954),
[licencia y habilitación](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0063923),
[Meet](https://support.google.com/meet/answer/9308681?hl=en),
[Teams webinars](https://support.microsoft.com/en-us/teams/meetings/manage-webinar-recordings-in-microsoft-teams),
[Teams almacenamiento](https://learn.microsoft.com/en-us/microsoftteams/tmr-meeting-recording-change).

## Zoom: puntos que condicionan el diseño

- EmbeddedClient ofrece `record('start'|'pause'|'stop')` para grabación cloud; los
  tipos instalados de Meeting SDK 6.5.0 coinciden. No es un grabador de pantalla
  local. [API SDK](https://marketplacefront.zoom.us/sdk/meeting/web/components/functions/EmbeddedClient.record.html).
- El cambio de una preferencia general no cubre automáticamente eventos ya
  programados. Hay que auditarlos y verificar su configuración individual.
  La política puede restringir pausa/parada de anfitriones; evaluar grupo de hosts
  dedicados sin afectar reuniones ajenas al producto. [Zoom automático](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067954).
- Los eventos `recording.started`, `recording.stopped` y `recording.completed`
  distinguen actividad de disponibilidad de archivos. `completed` contiene
  identidad de instancia y archivos; el token de descarga de ese evento tiene
  una ventana de 24 horas. Utilizar Authorization Bearer, no tokens en URLs.
  [Eventos](https://developers.zoom.us/docs/api/meetings/events/),
  [autorización de descarga](https://developers.zoom.us/docs/platform/announcements/).
- Verificar HMAC del cuerpo original, timestamp y firma; responder al webhook
  rápidamente y procesar después. Zoom exige ACK 200/204 dentro de tres segundos.
  [Webhooks](https://developers.zoom.us/docs/api/webhooks/).
- La documentación del ensayo de Webinar indica que la grabación cloud empieza
  al salir del ensayo. Validar ese comportamiento con la cuenta/versión reales y
  no publicar material de ensayo automáticamente.
  [Práctica Webinar](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0062566).
- E2EE deshabilita cloud recording. No desactivar esa protección silenciosamente:
  tratar la incompatibilidad como fallo de preflight.
  [E2EE](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0065408).
- Consultar grabaciones por API permite reconciliar notificaciones ausentes y
  recuperar metadatos/descargas con autorización. Los scopes efectivos se
  verifican contra el endpoint y app actuales, sin asumir que el permiso de
  programar Zoom concede lectura de grabaciones.
  [Cloud Recording API](https://developers.zoom.us/docs/api/meetings/).

No se promete resolución fija, cuota ilimitada, captura de overlays no enviados
a Zoom ni recuperación de contenido que nunca llegó a grabarse. La nube registra
la emisión de Zoom; una escena preparada solo en la vista local no se incorpora
por el hecho de existir en el banco de escenas.

## Hallazgos de los repositorios

Learning inspeccionado en `C:/Users/FerSG/Desktop/Soflia/SofLIA Learning/SofLIA-Learning`.
No se leyeron `.env` ni valores de credenciales, ni se hicieron llamadas a la cuenta.

- `apps/web/src/features/live/services/schedule.service.ts` elige `meetings` o
  `webinars`, tipos 2/5, y tiene reserva/idempotencia/compensación; sus settings no
  incluyen exigencia de grabación automática.
- `apps/web/src/app/api/internal/jobs/zoom-live/route.ts` es el receptor de eventos
  existente, pese a su nombre. Valida firma/cuenta y procesa inicio/fin/borrado;
  actualmente ignora eventos de grabación. Extenderlo evita duplicar recepción.
- `apps/web/src/features/live/zoom-webhook.ts` ya implementa HMAC, comparación
  constante y frescura del timestamp; reutilizarlo.
- `apps/web/src/features/live/zoom.server.ts` custodia OAuth Server-to-Server y
  reusa token administrativo; `studio-zoom.server.ts` genera firma/ZAK desde el host
  vinculado. Los permisos de grabación y cuota no se consultaron.
- `live_sessions` y `live_zoom_credentials` ya relacionan sesión, organización,
  curso, tipo de evento y anfitrión. No se encontró un archivo de vídeo de sesiones
  en el tipo `LiveDatabase` inspeccionado. Esta observación no descarta otros módulos
  de vídeo del repositorio: inventariarlos antes de crear persistencia nueva.
- Hub: `packages/zoom-runtime/runtime.ts` no llama record ni observa recording-change.
  `src/shared/live-studio.contract.ts` no transporta un estado de grabación.
- `docs/operations/live-studio-runtime.md` describe firma/licencias y despliegue
  pendiente. Su ruta de checkout anterior cambió; no se modifica ese documento
  en esta investigación para no mezclar trabajos.
- El bucket de materiales tiene límite de 25 MB y GC propio. No sirve como contrato
  para vídeos de webinars; diseñar almacenamiento y retención separados.

## Alternativas evaluadas

1. **Zoom cloud + archivo propio privado:** opción recomendada; captura del
   proveedor independiente de Hub, control académico propio y recuperación por API.
2. **Solo enlazar el vídeo de Zoom:** útil en PoC, pero no como producto final;
   las reglas de acceso/retención de Zoom no sustituyen las de Learning.
3. **MediaRecorder/Electron local:** segunda fase posible para una composición
   propia. Requiere mezcla de audio de participantes/micrófono sin eco, fuentes,
   chunks reanudables, disco, codecs, subida y recuperación tras crash. No es un
   reemplazo equivalente de la grabación cloud de la reunión con nuestro SDK.
4. **Bot o grabador servidor adicional:** más licencias, operación y permisos;
   no justificado como primera solución si la cuenta admite cloud.

Si la cuenta no tiene cloud, la primera decisión es habilitar licencia/capacidad
o definir explícitamente otro proveedor. No activar un fallback local incompleto
ni presentar como grabado un webinar sin confirmación.
