# SofLIA Extension -> Meeting Trigger -> Pulse Hub

## Objetivo

Nivelar la extension del navegador con el ecosistema operativo real de Pulse Hub.

La extension no debe limitarse a detectar transcripciones o a abrir la app. Debe poder:

1. Observar el DOM y la URL de la pestana activa.
2. Detectar cuando el usuario entra o permanece en una reunion.
3. Disparar a la aplicacion de escritorio para iniciar trazabilidad operativa.
4. Mantener esa trazabilidad mientras el usuario trabaja en otros archivos, documentos o pestañas durante la reunion.
5. Cerrar la sesion cuando la reunion termina.

---

## Regla de negocio clave

Hay dos conceptos distintos y ambos deben coexistir:

- `meeting_auto`:
  Sesion de monitoreo disparada por la extension o por otra deteccion automatica. Su objetivo es capturar evidencia operativa en tiempo real: screenshots, OCR, ventana activa, URL y cambios de foco.

- `meeting_run`:
  Caso formal de Meeting Ops. Solo debe existir cuando ya hay un artifact fuente autorizado: transcripcion, notas, minuta, resumen o documento fuente.

Conclusion:

- La extension SI inicia el seguimiento de la reunion.
- La extension NO crea por si sola el `meeting_run` final.
- El `meeting_run` sigue siendo artifact-backed.

Esto preserva la regla ya existente del dominio de reuniones:
"sin artifact valido no nace el workflow formal".

---

## Flujo extremo a extremo

```text
Extensión (DOM watcher)
  -> detecta URL / señales de reunion / pestaña activa
  -> abre soflia://meeting-trigger?action=start...
  -> Electron main recibe el deep link
  -> renderer procesa el trigger
  -> startMonitoringSession(userId, 'meeting_auto', meetingTitle)
  -> MonitoringService captura snapshots periodicos
  -> persistSnapshots guarda activity_logs en Lia
  -> activity_logs.metadata marca origen: browser_extension + meeting_auto

Durante la reunion:
  -> el usuario puede cambiar a Meet, Docs, Slides, Drive, Excel, IDE, PDF, etc.
  -> la trazabilidad sigue capturando contexto real de trabajo

Fin de la reunion:
  -> extension envia soflia://meeting-trigger?action=stop...
  -> renderer cierra la sesion de monitoreo activa

Despues:
  -> Passive detection / Drive / Gmail / notas manuales producen un artifact valido
  -> MeetingWorkflowService crea el meeting_run formal
  -> IA + HITL + sync a IRIS
```

---

## Contrato de integracion

### Canal recomendado

Usar protocolo nativo:

`soflia://meeting-trigger?...`

Ventajas:

- no requiere exponer puertos locales
- funciona con la app empaquetada
- evita acoplar la extension a Electron IPC
- se alinea con el protocolo ya usado por `soflia://share/...`

### Acciones soportadas

- `start`
- `heartbeat`
- `stop`

### Query params esperados

| Parametro | Requerido | Uso |
|-----------|-----------|-----|
| `action` | no | `start`, `heartbeat`, `stop`; default `start` |
| `provider` | no | `google_meet`, `zoom`, `teams`, etc. |
| `meetingTitle` | no | titulo visible de la reunion |
| `meetingUrl` | no | URL principal de la reunion |
| `meetingCode` | no | codigo de Meet o identificador similar |
| `tabUrl` | no | URL exacta de la pestaña activa |
| `tabId` | no | id de pestaña del browser |
| `detectedAt` | no | timestamp ISO del trigger |
| `source` | no | origen de deteccion: `dom-watch`, `url-watch`, `active-tab` |
| `reason` | no | por que se disparo: `meeting_started`, `meeting_ended`, etc. |
| `extensionVersion` | no | version de la extension |
| `browser` | no | `chrome`, `edge`, etc. |
| `triggerId` | no | idempotencia del trigger |

### Ejemplos

Inicio:

```text
soflia://meeting-trigger?action=start&provider=google_meet&meetingTitle=Comite%20Semanal&meetingCode=abc-defg-hij&meetingUrl=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij&tabUrl=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij&source=dom-watch&reason=meeting_started&browser=chrome
```

Heartbeat:

```text
soflia://meeting-trigger?action=heartbeat&meetingCode=abc-defg-hij&tabUrl=https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij&source=dom-watch&reason=meeting_still_active
```

Cierre:

```text
soflia://meeting-trigger?action=stop&meetingCode=abc-defg-hij&source=dom-watch&reason=meeting_ended
```

---

## Comportamiento de la app

### Dedupe

Si ya existe una sesion `meeting_auto` activa para la misma reunion:

- `start` no reinicia nada
- `heartbeat` solo confirma continuidad
- `stop` cierra la sesion correcta

### Seguridad operacional

Si ya hay otra sesion de monitoreo activa no relacionada:

- el trigger externo NO la interrumpe
- se responde con un `noop/busy` interno
- se privilegia no romper una sesion existente

### Persistencia

La sesion de monitoreo se persiste como un bloque normal en Lia:

- tabla `monitoring_sessions`
- `trigger_type = meeting_auto`
- `calendar_event_title` reutilizado como label legible de la reunion

Y cada snapshot se guarda en `activity_logs` con metadata enriquecida:

- `source = meeting_auto`
- `trigger_origin = browser_extension`
- `meeting_title`
- `meeting_code`
- `source_ref`
- `provider`
- `browser`
- `extension_version`
- `tab_url`
- `tab_id`

Esto da trazabilidad incluso cuando el usuario cambia de ventana durante la reunion.

---

## Archivos relevantes

### Main / protocolo

- `electron/app-protocol.ts`
- `electron/main.ts`
- `electron/preload.ts`

### Renderer / bridge

- `src/services/app-meeting-trigger-service.ts`
- `src/services/meeting-auto-session-store.ts`
- `src/services/monitoring-service.ts`
- `src/App.tsx`

### Workflow formal de reuniones

- `electron/meetings/meeting-workflow-service.ts`
- `electron/meetings/meeting-passive-detection-service.ts`
- `electron/meeting-handlers.ts`
- `src/services/meeting-service.ts`
- `src/components/meetings/MeetingOpsPanel.tsx`

---

## Responsabilidad esperada de la extension

La extension debe correr un watcher ligero y constante sobre:

- URL de la pestaña
- titulo del documento
- indicadores DOM de llamada activa
- texto visible de botones como "Salir de la llamada", "Presentas", "Participantes", etc.
- cambios de foco entre tabs de Meet y documentos relacionados

Politica recomendada:

1. Detectar `start` una sola vez al entrar a reunion real.
2. Enviar `heartbeat` cada 20-30 segundos mientras la reunion siga viva.
3. Enviar `stop` al cerrar la llamada, perder los indicadores o cambiar a un estado terminal estable.

---

## Limitaciones actuales

- Hoy `meeting_auto` y `meeting_run` viven separados por diseno.
- La vinculacion automatica entre ambos todavia debe hacerse en una fase siguiente usando `meetingCode`, `source_ref` o heuristicas temporales.
- La app captura evidencia visual y contextual; no reemplaza la necesidad de un artifact fuente autorizado para sincronizar acciones a IRIS.

---

## Siguiente fase recomendada

1. Agregar linking explicito entre `meeting_auto` y `meeting_run`.
2. Mostrar en Meeting Ops una seccion de "Evidencia de reunion" con:
   - cantidad de snapshots
   - apps/documentos abiertos
   - OCR destacado
   - cambios de contexto durante la reunion
3. Unificar la deteccion pasiva de Calendar/Gmail/Drive con la evidencia viva disparada por extension.
4. Exponer un resumen de trazabilidad en el asset final para que HITL revise no solo la transcripcion sino tambien la ejecucion real observada.
