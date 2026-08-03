# Desktop Agent — Arquitectura de Control Autónomo de Computadora

> Estado: activo · Última actualización: julio 2026 · Rama: `feature/desktop-agent-confiable`
>
> Este documento describe la arquitectura del **Desktop Agent** de Pulse Hub: el
> subsistema que permite a un modelo de lenguaje (Gemini/GPT/Claude) operar la
> computadora del usuario de forma autónoma — abrir aplicaciones, encontrar y
> clickear controles, escribir, arrastrar y completar tareas como lo haría una
> persona. Cubre el diseño, las decisiones tomadas, las limitaciones conocidas y
> cómo probar/depurar.

---

## 1. Objetivo y principios

El agente debe ejecutar órdenes en lenguaje natural ("abre Minecraft y ejecútalo",
"reproduce esta canción en YouTube Music") sobre **cualquier** aplicación
(nativa Win32, Chromium/Electron, Java, terminal, juegos) y, a futuro, sobre
**cualquier sistema operativo** (Windows hoy; macOS/Linux por diseño).

Principios de diseño:

- **Determinista antes que visión.** Si algo se puede resolver con una API del
  sistema (lanzar una app por su nombre, abrir una URL, enfocar una ventana,
  leer el árbol de accesibilidad), se hace así — es exacto y rápido. La visión
  con clicks estimados es el **último recurso**.
- **Medir, no adivinar.** La posición de un control se **mide** con la fuente
  más confiable disponible (accesibilidad → OCR), no se estima a ojo sobre una
  captura reducida.
- **Coordenadas físicas de punta a punta.** Toda la síntesis de entrada trabaja
  en píxeles físicos de pantalla, sin reconversiones que introduzcan error.
- **Humano, no robótico.** El mouse se mueve por trayectorias suaves; el teclado
  escribe con micro-retardos.
- **Config-driven con rollback.** Cada capacidad nueva tiene un flag para
  revertir a la conducta previa.
- **Sin deuda técnica.** Módulos con responsabilidad única, testeables en
  aislamiento; todo el código/logs/prompts en español.

---

## 2. Bucle Percepción → Planeación → Acción

```
Tarea (lenguaje natural)
   │
   ▼
[Contexto de entorno]  ventanas abiertas · apps instaladas · monitores
   │
   ▼
[Planeación estratégica]  fases + presupuesto de pasos
   │
   ▼
┌─ por cada paso (hasta el presupuesto) ──────────────────────────┐
│  [Percepción]  captura (monitor activo) → layout inmutable      │
│  [Decisión]    el modelo de visión elige UNA acción             │
│  [Acción]      determinista | click-por-texto medido | click x,y│
│  [Verificación] ¿cambió la pantalla? ¿atascado?                 │
└─────────────────────────────────────────────────────────────────┘
   │
   ▼
[Outcome estructurado]  completada | fallida | presupuesto_agotado | ...
```

Archivos: `desktop-agent-service.ts` (orquestador, mixins `service-*.ts`),
`task-execution-runtime.ts` (bucle del paso), `vision-step-runtime.ts` +
`vision-prompt*.ts` (decisión), `action-executor.ts` (ejecución).

---

## 3. Pipeline de coordenadas (el problema central)

Históricamente el agente fallaba al traducir "lo que el modelo ve" (una imagen
reducida) a "dónde clickear" (píxeles físicos), especialmente en un setup de
**3 monitores con distinta resolución, DPI y frecuencia**. La solución:

### 3.1 Captura por estrategia (`capture-strategy.ts`)
- **`active-monitor`** (default): captura SOLO el monitor de la ventana activa.
  Bounds estables entre "decidir" y "actuar", íconos legibles. El cambio de
  monitor se hace con `focus_window` (determinista), no con scroll visual.
- `focused-window` y `all-monitors` disponibles como alternativas/rollback.

### 3.2 Resolución adaptativa (`screenshot-layout.ts`)
`computeAdaptiveTargetSize` garantiza `renderScale ≥ minRenderScale` (0.5) acotado
por `maxScreenshotEdge` (1568) — nunca vuelve a comprimir un escritorio de
5206 px en 1024, que hacía los controles ilegibles.

### 3.3 Layout inmutable por paso (`activeStepLayout`)
El bug más sutil: el estado de escala/layout era **mutable y compartido**, y una
captura de verificación o de zoom lo sobrescribía → el click se resolvía contra
un layout distinto al de la imagen que el modelo vio. Ahora cada captura tiene
un `purpose` (`decision` / `verification` / `zoom`) y solo la de **decisión**
fija el `activeStepLayout` contra el que se resuelven las coordenadas.

### 3.4 Conversión DIP ↔ físico correcta (`screenshot-coordinates.ts`)
`GetWindowRect` devuelve píxeles **físicos**; los bounds de Electron son **DIP**.
`physicalRectToDipRect` convierte antes de intersectar, eliminando el doble
escalado en monitores con DPI ≠ 100 %.

### 3.5 Autotest de calibración (`coordinate-selftest.ts`)
`desktop-agent:run-calibration` mueve el cursor a puntos conocidos por monitor y
verifica con `GetCursorPos` (tolerancia ±2 px). Se auto-ejecuta al cambiar la
topología de monitores.

---

## 4. Localización de elementos por texto (`element-locator/`)

El corazón de "medir, no adivinar". Cuando el modelo quiere clickear un control
con texto legible (botón, pestaña, ítem de menú), emite
`click_element_by_name` con el texto y una **coordenada aproximada** de dónde lo
ve. El locator lo ubica con una **cadena de proveedores**:

```
localizarPorTexto(texto, pistaFísica?)
   │
   ├─▶ [Proveedor UIA]  accesibilidad nativa (Windows)  ── exacto, semántico
   │        └─ vía worker persistente (§5)
   │
   └─▶ [Proveedor OCR]  lectura de píxeles (tesseract)   ── universal
            └─ funciona en Chromium/Java/juegos/terminal
```

- **Contrato** (`types.ts`): cada proveedor devuelve el elemento con su
  `centroFisico` (píxeles físicos), su fuente y confianza.
- **Matching de texto** (`text-matching.ts`, puro): tolerante a acentos,
  mayúsculas, espacios y puntuación (OCR confunde símbolos); con guardas contra
  fragmentos triviales (un `"-"` no matchea un objetivo largo).
- **Desambiguación espacial** (`candidate-selection.ts`): cuando el mismo texto
  aparece varias veces (p.ej. "MINECRAFT" en el logo central **y** en la pestaña
  lateral), el score de texto manda; ante empate, gana el candidato **más
  cercano a la pista** que el modelo indicó. El modelo apunta grosso modo, el
  locator mide fino. Este fue el fix del "cursor saltando arriba-abajo".
- **OCR de precisión** (`ocr-service.ts`, `ocr-provider.ts`): captura dedicada de
  mayor resolución (`ocrCaptureEdge` 1600) y `user_defined_dpi: '96'` para leer
  fuentes de UI difíciles (evita el warning "Invalid resolution 25 dpi").

El click final va por el **InputDriver** (§6) en píxeles físicos, sin
reconversión imagen→físico.

---

## 5. Worker de PowerShell persistente (`native-worker/`)

**Problema resuelto:** los scripts de UI Automation se pasaban por
`powershell -EncodedCommand <base64>`; el script codificado (~10.6 KB) rebasaba
el **límite de 8191 caracteres** de la línea de comandos de Windows ("La línea
de comandos es demasiado larga") — cada llamada UIA fallaba, y además cada
invocación arrancaba un proceso nuevo (~1–3 s + compilación de `Add-Type`).

**Solución:** un único proceso PowerShell de larga vida.

- El script de arranque (`worker-script.ts`) se entrega por **STDIN** (sin
  límite de longitud), compila los ensamblados UIA/user32 **una sola vez** y
  entra en un bucle que lee peticiones JSON línea por línea y escribe respuestas
  con el prefijo centinela `##SOFLIA##` (para filtrar el ruido de PowerShell).
- El lado TS (`powershell-worker.ts`) correlaciona request/response por `id`,
  aplica timeout por petición, reinicia con backoff ante crash y termina solo
  cuando Electron cierra su stdin.
- **Despertar de accesibilidad:** apps Chromium/Java construyen su árbol de
  accesibilidad de forma **perezosa** — la primera consulta lo dispara. El
  worker consulta, y si vinieron menos de `uiaSparseThreshold` (8) elementos,
  espera `uiaWakeDelayMs` (1200 ms) y **reconsulta**.

**Validado en máquina real:** PING ~500 ms (compilación incluida, una vez);
`locateByText` sobre una ventana con árbol grande: 633 elementos en ~800 ms.

---

## 6. Entrada nativa humana (`input-driver/`)

**Problema resuelto:** el mouse se **teletransportaba** con `SetCursorPos` y cada
operación pagaba la latencia de un proceso PowerShell nuevo.

**Solución:** capa `InputDriver` con backend nativo.

- **Backend `nut.js`** (`@nut-tree-fork/nut-js`) — el mismo runtime C++ que usa
  UI-TARS Desktop de ByteDance. In-process (latencia ~0), multiplataforma
  (Windows/macOS/Linux), N-API (ABI-estable, no requiere recompilar).
- **Movimiento humano** (`human-motion.ts`, puro/testeable): trayectoria con
  curva Bézier cúbica + jitter acotado + timing ease-in-out; la duración crece
  con la distancia (ley de Fitts). El cursor **se desplaza** hacia el destino en
  vez de saltar.
- **Contrato** (`types.ts`): `moveTo`, `click`, `doubleClick`, `dragTo`,
  `scroll`, `typeText` (con micro-retardos), `pressKeys`. Coordenadas físicas.
- **Factory con fallback** (`input-driver.ts`): elige backend por config; si
  `nut.js` no carga, cae automáticamente al **backend legacy** (PowerShell/
  xdotool) — el agente nunca queda sin control de entrada.
- **Cableado sin recursión:** `mouse-controls.ts` y `keyboard-controls.ts`
  delegan en el driver vía `setInputDriver`; la implementación raw
  (PowerShell/xdotool) queda separada para que el backend legacy no recurse.

**Validado en Electron 39.8.5:** movimiento de cursor por trayectoria y
restauración al píxel exacto.

---

## 7. Acciones deterministas y contexto de entorno

### 7.1 Abrir apps y URLs (`deterministic-actions.ts`, `app-open-tool.ts`)
- `open_application` resuelve el nombre a un ejecutable con una cadena de
  fuentes: **índice de apps instaladas** → registro → PATH → accesos directos.
  El índice (`installed-apps-index.ts`) cataloga el Menú Inicio **incluyendo
  apps UWP/Microsoft Store** vía `Get-StartApps` (que no tienen `.lnk`), y las
  lanza con `explorer.exe shell:AppsFolder\<AppID>`.
- `open_url` abre en el navegador predeterminado (validando la URL).
- Ambas son **la vía preferida**: "abrir Minecraft" es 1 paso determinista, no
  12 clicks buscando iconos en la barra de tareas.

### 7.2 Contexto de entorno (`environment-context.ts`)
Antes de planificar, el agente construye un "paquete de contexto del equipo":
ventanas abiertas, ventana activa, monitores (con su escala) y apps instaladas.
El planner actúa como un usuario que **conoce su máquina**: si la app ya está
abierta usa `focus_window`; si no, `open_application`/`open_url`.

---

## 8. Ciclo de vida y contrato de finalización

**Problemas resueltos:** el agente decía "listo" mientras seguía ejecutando;
dos tareas visuales corrían a la vez y se corrompían mutuamente; una tarea
simple quemaba 200 pasos.

- **Single-instance** (`maxConcurrentAgents: 1`): el escritorio visual tiene UN
  mouse y UN teclado, y el estado del paso vive en el servicio. Las tareas
  adicionales esperan en cola.
- **Cola con timeout y cancelación** (`task-entrypoint.ts`, `task-control.ts`):
  una tarea encolada expira (`queueTimeoutMs` 60 s) y acepta `AbortSignal` —
  nunca se ejecuta a espaldas del usuario minutos después.
- **Presupuesto de pasos** (`task-budget.ts`): `maxSteps: 60` es el tope duro; el
  presupuesto real es proporcional al plan (2× pasos estimados, mín. 15).
- **Outcome estructurado** (`task-outcome.ts`): `completada | fallida |
  cancelada | presupuesto_agotado | cola_expirada`. El tool `use_computer`
  reporta este estado; el agente conversacional **solo afirma éxito con
  `completada`** — con otros estados reporta el progreso real.
- **Sin reintentos inútiles** (`action-errors.ts`): un fallo determinista
  (elemento/app no encontrado, campo faltante) no se reintenta 3 veces.
- **Timeout de herramienta largo:** en el lado renderer, `use_computer` tiene un
  presupuesto de 15 min (no 30 s) para no abandonar tareas que tardan minutos —
  lo que causaba agentes duplicados.

---

## 9. Configuración y rollback

Config en `agent-config.ts`, persistida en
`userData/desktop-agent-config.json`. Flags clave (con su default):

| Flag | Default | Qué controla |
|---|---|---|
| `inputBackend` | `'nut'` | Backend de entrada (`'legacy'` = PowerShell/SetCursorPos) |
| `humanMotionEnabled` | `true` | Movimiento humano del mouse |
| `humanTypingEnabled` | `true` | Tecleo con micro-retardos |
| `uiaWorkerEnabled` | `true` | Accesibilidad UIA (`false` = solo OCR) |
| `uiaSparseThreshold` | `8` | Umbral para el despertar de accesibilidad |
| `uiaWakeDelayMs` | `1200` | Espera antes de reconsultar el árbol |
| `ocrCaptureEdge` | `1600` | Resolución de la captura dedicada para OCR |
| `captureStrategy` | `'active-monitor'` | Estrategia de captura |
| `layoutBindingEnabled` | `true` | Layout inmutable por paso |
| `minRenderScale` / `maxScreenshotEdge` | `0.5` / `1568` | Resolución adaptativa |
| `deterministicFirstEnabled` | `true` | Preferir open_application/open_url/UIA |
| `environmentContextEnabled` | `true` | Contexto de entorno en el prompt |
| `maxConcurrentAgents` | `1` | Serialización de tareas visuales |
| `maxSteps` / `defaultStepBudget` | `60` / `40` | Presupuesto de pasos |
| `queueTimeoutMs` | `60000` | Expiración en cola |
| `keywordRoutingEnabled` | `true` | Ruteo por palabras clave a browser/uia |

**Rollback total** ≈ conducta anterior:
`{ inputBackend: 'legacy', humanMotionEnabled: false, uiaWorkerEnabled: false,
captureStrategy: 'all-monitors', layoutBindingEnabled: false,
legacyScaleFallbackEnabled: true, deterministicFirstEnabled: false }`.

---

## 10. Acciones disponibles para el modelo

`open_application`, `open_url`, `click_element_by_name` (con `x,y` de pista),
`click` / `double_click` / `right_click` / `drag`, `type`, `key`, `scroll`,
`zoom`, `focus_window` / `minimize_window` / `maximize_window` /
`restore_window` / `close_window`, `wait` / `wait_for_change` /
`wait_for_window`, `done` / `fail`. Contrato JSON en `vision-prompt-rules.ts`;
las acciones se validan contra el union antes de ejecutarse (`parsers.ts`).

---

## 11. Limitaciones conocidas y trabajo futuro

- **Apps Chromium/Electron/juegos 100 % opacas.** Si una app no expone su árbol
  de accesibilidad **y** su texto no es legible por OCR (canvas, íconos sin
  texto), no hay forma de medir el control por texto. Hoy se cae a click por
  coordenadas de visión (imperfecto).
- **Endgame documentado (no implementado):** el estado del arte para estos casos
  es un **parser visual de elementos** tipo
  [OmniParser](https://github.com/microsoft/OmniParser) (Microsoft) — un modelo
  que detecta regiones clickeables por visión pura, sin depender de texto ni
  accesibilidad. Es lo que usan agentes SOTA como UI-TARS/UGround. **No se
  implementó** porque exige empaquetar Python + modelos (YOLO + captioner,
  idealmente GPU) — peso, latencia y deuda técnica injustificables hoy. Si el
  producto lo demanda, debe ir detrás de un **servicio opcional**, no en el hot
  path.
- **macOS/Linux:** el diseño es multiplataforma (nut.js, OCR, xdotool en el
  backend legacy), pero el worker UIA es específico de Windows; los equivalentes
  son **AX** (macOS) y **AT-SPI** (Linux), pendientes de implementar como
  proveedores adicionales del `element-locator`.

---

## 12. Cómo probar y depurar

- **Tests unitarios** (`electron/__tests__/`, vitest): `desktop-agent-*` cubren
  coordenadas multi-monitor, binding de layout, worker (protocolo/timeout/
  reinicio), human-motion, input-driver (fallback), element-locator
  (matching/desambiguación/OCR), budget y cola. `npm run test:main`.
- **Calibración en hardware real:** desde DevTools del renderer,
  `await window.desktopAgent.runCalibration()` — reporta delta por monitor
  (criterio ±2 px).
- **E2E manual:** una orden como "Abre Minecraft y ejecútalo". En el log observar:
  `Backend de entrada: nut.js (movimiento humano activo)`, `open_application ...
  via indice`, `click_element_by_name "..." via uia|ocr en fisico (x, y)` con la
  coordenada de pista, y `outcome.estado`.
- **Rollback rápido:** editar `userData/desktop-agent-config.json` con los flags
  legacy si una capacidad nueva causa regresión.

---

## 13. Historial de iteraciones (resumen)

1. **Coordenadas multi-monitor + determinista-primero + ciclo de vida** — layout
   inmutable, fix DIP/físico, acciones deterministas, outcome estructurado.
2. **Serialización + índice de apps + focus_window robusto** — single-instance,
   índice primero, `SwitchToThisWindow`, comandos read-only sin confirmación.
3. **Ruteo de acción vs. investigación** — órdenes ("abre X") tienen prioridad
   sobre el grounding web.
4. **Apps UWP + timeout largo + PowerShell multilínea** — `Get-StartApps`,
   `use_computer` a 15 min, `psEncoded` para scripts multilínea.
5. **`click_element_by_name` (medición por texto)** — primero solo UIA.
6. **Element-locator universal** — cadena UIA → OCR, matching robusto.
7. **Infraestructura nivel producto** — worker UIA persistente (fin del límite de
   8191 chars), nut.js con movimiento humano, OCR de precisión, regla anti-zoom.
8. **Desambiguación espacial** — pista de coordenada para elegir la ocurrencia
   correcta cuando el texto se repite.
