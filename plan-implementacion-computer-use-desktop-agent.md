# Plan de implementación — Computer Use Desktop Agent multimonitor / DPI-aware

## Actualizacion 2026-07-04 — Handoff para Claude Code

Esta seccion documenta el cierre implementado por Codex para reducir clicks ambiguos en el Desktop Agent. El objetivo inmediato fue corregir el fallo visto con Minecraft Launcher: el agente ve el boton verde `JUGAR`, pero cuando `click_element_by_name` no lo resuelve, degrada a `click` por coordenadas y el `snap semantico` mueve el punto hacia textos/panes equivocados o incluso hacia otra ventana/monitor.

### Estado implementado

1. **OmniParser / ONNX opcional**
   - Se agrego `onnxruntime-node@^1.27.0` en `package.json` / `package-lock.json`.
   - Se agrego `npm run desktop-agent:install-omniparser`.
   - El script nuevo esta en `scripts/install-omniparser-model.js`.
   - El modelo se descarga solo de forma explicita a `models/omniparser-icon-detect.onnx`.
   - No se bundlea el modelo ONNX ni se descarga silenciosamente.
   - `.gitignore` ignora `models/*.onnx` y temporales.
   - `electron-builder.json5` agrega `asarUnpack` para `onnxruntime-node`.
   - El parser ONNX ahora expone diagnostico estructurado: runtime disponible, sharp disponible, ruta del modelo, existencia del modelo y disponibilidad final.

2. **Set-of-Marks con fuente visual**
   - El proyecto ya tenia `electron/desktop-agent/visual-parser/` y `electron/desktop-agent/element-source/`.
   - Se completo el logging para saber si el Set-of-Marks viene de `uia`, `ocr` o `visual`.
   - `createCompositeElementSource` ahora loguea conteos por fuente y marcas finales.
   - Si UIA devuelve suficientes elementos, OCR puede omitirse para reducir ruido, pero la fuente `visual` ONNX sigue corriendo cuando esta disponible para detectar controles opacos.
   - Esto es importante para botones dibujados como el `JUGAR` verde de Minecraft Launcher.

3. **Clicks crudos ya no hacen snap semantico**
   - Se modifico `electron/desktop-agent/action-coordinate-refinement.ts`.
   - Antes, `click`, `double_click`, `right_click` y `type` podian moverse al centro de un `Text`, `Pane`, `Document` o elemento cercano.
   - Ese comportamiento causo logs como:
     - `Snap semantico principal: dentro de Text "..."`
     - coordenada visual correcta -> centro equivocado.
   - Ahora el click crudo solo se ajusta si cae en padding/fuera del area visible. No se centra automaticamente en elementos estructurados.
   - El camino correcto para elementos estructurados es `click_element` con `elementId`.

4. **Bloqueo de fallback peligroso**
   - Se extendio `runDesktopActionWithRetry` para aceptar `rejectUnsafeAction`.
   - Si `click_element_by_name` falla deterministamente y tenia `x,y`, se guarda esa intencion como target fallido.
   - Si el siguiente paso intenta un `click` crudo cerca de ese mismo punto, se bloquea antes de ejecutar input.
   - El mensaje esperado es:
     - `Click crudo bloqueado: coincide con target semantico fallido ... Usa click_element con elementId, zoom o replan...`
   - Esto evita que el modelo haga: "no encontre texto JUGAR" -> "entonces click directo al mismo lugar".

5. **Memoria corta de targets fallidos**
   - Ya existia memoria corta para targets que no cambiaban pantalla.
   - Se reforzo para incluir fallos deterministas de `click_element_by_name`.
   - TTL actual: 6 pasos.
   - Maximo retenido: 20 targets.
   - Se conserva dentro de `service.failedActionTargets`.

6. **Window lock por tarea**
   - Se agrego `electron/desktop-agent/window-lock.ts`.
   - Se establece lock cuando una accion exitosa es:
     - `open_application`
     - `focus_window`
     - `wait_for_window`
   - Antes de cada captura de decision se llama `ensureTargetWindowLock`.
   - Si la ventana activa no coincide con el lock, se re-enfoca y se loguea:
     - ventana objetivo
     - ventana activa
     - resultado de `focusWindow`
   - Esto apunta al fallo del log donde el agente alternaba entre Minecraft Launcher y Chrome.

7. **Presupuesto minimo para launchers/juegos**
   - Se modifico `electron/desktop-agent/task-budget.ts`.
   - Tareas que mencionan `minecraft`, `launcher`, `java edition`, `juego`, `game` o apertura de apps nativas tienen minimo efectivo de 35 pasos.
   - Esto evita que un plan optimista de 2 pasos se convierta en solo 15 pasos para abrir launcher, esperar carga e iniciar juego.

8. **Tipos extendidos**
   - `ResolvedActionTarget` ya cubre `text`, `element` y `point`.
   - Se agrego `TargetWindowLock`.
   - `DesktopAgentService` ahora conserva:
     - `visualParserAvailabilityLogged`
     - `targetWindowLock`

9. **Pruebas agregadas o ampliadas**
   - `electron/__tests__/desktop-agent-visual-parser.test.ts`
     - diagnostico ONNX cuando falta el modelo.
   - `electron/__tests__/desktop-agent-element-source.test.ts`
     - fuente visual agrega marcas aunque UIA sea suficiente.
   - `electron/__tests__/desktop-agent-coordinate-pipeline.test.ts`
     - click crudo no hace snap semantico hacia `Text`.
   - `electron/__tests__/desktop-agent-action-retry.test.ts`
     - fallo determinista recuerda target.
     - accion insegura se rechaza antes de ejecutar.
     - target fallido bloquea click crudo cercano.
   - `electron/__tests__/desktop-agent-deterministic-actions.test.ts`
     - `click_element` usa centro de `elementId`.
   - `electron/__tests__/desktop-agent-window-lock.test.ts`
     - lock de ventana detecta Chrome vs Minecraft y re-enfoca.
   - `electron/__tests__/desktop-agent-task-budget.test.ts`
     - minimo 35 pasos para Minecraft/launcher.

### Validacion ejecutada

Codex ejecuto y paso:

```powershell
npm.cmd run test:main -- electron/__tests__/desktop-agent-element-source.test.ts electron/__tests__/desktop-agent-visual-parser.test.ts electron/__tests__/desktop-agent-coordinate-pipeline.test.ts electron/__tests__/desktop-agent-action-retry.test.ts electron/__tests__/desktop-agent-deterministic-actions.test.ts electron/__tests__/desktop-agent-window-lock.test.ts electron/__tests__/desktop-agent-task-budget.test.ts
```

Resultado:

```txt
7 test files passed
64 tests passed
```

Tambien paso:

```powershell
npm.cmd run build
```

El build completo genero instalador correctamente. Warnings no bloqueantes vistos:

- Vite: chunks grandes y imports dinamicos/estaticos mezclados.
- Electron Builder: dependencias duplicadas y recomendacion de postinstall.
- Node: warning de `scripts/generate-bitmaps.js` sin `type`.
- `npm install` reporto vulnerabilidades existentes en el arbol; no se corrigieron en este cierre para evitar cambios fuera de alcance.

### Como activar OmniParser localmente

Para que la fuente visual ONNX aporte marcas reales, Claude Code debe instalar el modelo localmente:

```powershell
npm.cmd run desktop-agent:install-omniparser
```

Luego confirmar que existe:

```powershell
Get-Item .\models\omniparser-icon-detect.onnx
```

Alternativa:

```powershell
$env:OMNIPARSER_MODEL_PATH="C:\ruta\al\omniparser-icon-detect.onnx"
npm.cmd run dev
```

Importante:

- El modelo no debe commitearse.
- El script muestra aviso de licencia porque los pesos de OmniParser icon_detect tienen aviso AGPL en la documentacion del proyecto/modelo.
- No cambiar esto a auto-descarga silenciosa.

### Pendiente para Claude Code

Claude Code debe terminar con validacion real en escritorio, no solo tests unitarios:

1. Ejecutar `npm.cmd run desktop-agent:install-omniparser`.
2. Ejecutar `npm.cmd run dev`.
3. Pedir de nuevo: `Abre y Ejecuta Minecraft Java en su ultima version`.
4. Revisar logs esperados:
   - `OmniParser/ONNX` con `disponible: true`.
   - `Fuentes Set-of-Marks` con conteos para `uia`, `ocr` y/o `visual`.
   - El boton `JUGAR` debe aparecer marcado como `[N]`.
   - El modelo debe elegir `click_element` con `elementId`, no `click`.
   - No debe aparecer `Snap semantico principal`.
   - Si falla `click_element_by_name`, el siguiente `click` crudo cercano debe bloquearse.
   - Si Chrome queda activo mientras el objetivo es Minecraft Launcher, debe aparecer `Window lock` y re-focus.
5. Si el boton `JUGAR` no recibe marca `[N]`, revisar en este orden:
   - disponibilidad real de ONNX/modelo;
   - salida de `visual` en `Fuentes Set-of-Marks`;
   - mapeo imagen -> DIP -> fisico de `createVisualElementSource`;
   - overlay SoM en `applySoMOverlay`;
   - umbrales `scoreThreshold` y `nmsIouThreshold` del parser ONNX.
6. Si el modelo sigue usando `click` crudo aunque hay marcas:
   - reforzar `vision-prompt-rules.ts` para prohibir `click` crudo cuando existe un marcador visible sobre el objetivo;
   - agregar test de prompt para esa regla;
   - considerar que `parseDesktopActionResponse` rechace `click` crudo cuando `captureMode === 'som'` y existe `elementId` razonable cerca.
7. Si hay cambio de monitor/ventana:
   - validar que `targetWindowLock` se establece despues de `open_application`/`focus_window`;
   - validar `getActiveWindow` en Windows con `active-win`;
   - si `focusWindow` devuelve true pero Windows niega foreground, agregar espera/verificacion adicional antes de capturar.

### Criterio de cierre pendiente

Este cierre no se considera completo hasta que haya un run manual con Minecraft Launcher donde:

- `JUGAR` este marcado por Set-of-Marks.
- La accion ejecutada sea `click_element`.
- No haya fallback a `click` crudo.
- No haya snap semantico hacia textos o panes.
- La tarea no agote presupuesto antes de que Minecraft empiece a cargar.
- Los logs permitan explicar cada decision de target.

### Archivos principales modificados por este cierre

- `package.json`
- `package-lock.json`
- `.gitignore`
- `electron-builder.json5`
- `scripts/install-omniparser-model.js`
- `electron/desktop-agent/visual-parser/types.ts`
- `electron/desktop-agent/visual-parser/onnx-parser.ts`
- `electron/desktop-agent/element-source/composite-element-source.ts`
- `electron/desktop-agent/service-coordinates.ts`
- `electron/desktop-agent/action-coordinate-refinement.ts`
- `electron/desktop-agent/desktop-action-runner.ts`
- `electron/desktop-agent/task-execution-action.ts`
- `electron/desktop-agent/window-lock.ts`
- `electron/desktop-agent/task-budget.ts`
- `electron/desktop-agent/task-execution-runtime.ts`
- `electron/desktop-agent/task-execution-state.ts`
- `electron/desktop-agent/action-types.ts`
- `electron/desktop-agent-types.ts`
- `electron/desktop-agent-service.ts`

### Advertencias para Claude Code

- El worktree ya tenia muchos cambios previos. No revertir archivos no relacionados.
- No usar `git reset --hard` ni checkout destructivo.
- Mantener `nut.js` como backend de input.
- Mantener coordenadas finales centralizadas en el pipeline actual.
- No meter el modelo ONNX en git ni en el instalador.
- Produccion prioriza no equivocarse: ante ambiguedad, bloquear, hacer zoom o replanificar.

## Contexto

Este plan está diseñado para implementar mejoras en el agente de **Computer Use** dentro de una aplicación **Electron + React**, orientada a automatizar acciones reales del usuario en escritorio mediante mouse, teclado y visión de pantalla.

El objetivo **no** es automatizar navegadores con Playwright. Para navegación web ya existen herramientas especializadas. El objetivo de este módulo es controlar el escritorio del usuario en **Windows, Linux y macOS**, permitiendo tareas como:

- Abrir aplicaciones.
- Navegar menús del sistema.
- Hacer clic en botones visibles.
- Llenar formularios.
- Interactuar con aplicaciones externas como Excel, launchers, ventanas nativas, clientes de escritorio, etc.
- Ejecutar flujos de productividad donde el usuario normalmente usaría mouse y teclado.

Actualmente el sistema usa `nut.js` como backend de entrada, pero el problema principal no está únicamente en `nut.js`, sino en la forma en que el agente interpreta y transforma coordenadas entre distintos espacios: screenshot, pantalla virtual, monitores, DPI, offsets y coordenadas físicas.

---

## Problema observado en el log

En el log actual se observa lo siguiente:

```txt
[DesktopAgent] Backend de entrada: nut.js (movimiento humano activo).

[DesktopAgent] Escala inicial: virtual 5206x1080, render 0.1967, offset 0,278

[DesktopAgent] Escala corregida:
screenshot 1024x768 -> virtual 1920x1080,
scale 1.88x1.41, render 0.5333, offset 0,96

[DesktopAgent] Escala corregida:
screenshot 1024x768 -> virtual 1366x768,
scale 1.33x1.00, render 0.7496, offset 0,96
```

Después, el sistema intenta hacer clic sobre elementos detectados por OCR:

```txt
[DesktopAgent] click_element_by_name "MINECRAFT: JAVA EDITION"
-> "MINECRAFT" via ocr en fisico (-1285, 561)

[DesktopAgent] click_element_by_name "MINECRAFT: JAVA EDITION"
-> "Minecraft" via ocr en fisico (-1317, 234)
```

Y también convierte puntos de imagen a coordenadas de pantalla:

```txt
[DesktopAgent] Coordenadas resueltas (click):
punto img (60, 300)
-> dip (-1286.0, 494.1)
-> screen (-1286, 494)
[monitor 1 (display 4058775692)]
```

El agente termina repitiendo clics sin lograr cambio de pantalla:

```txt
[DesktopAgent] ATASCADO — pantalla sin cambios durante 4 pasos
[DesktopAgent] Recuperacion proactiva solicitada - razon: stuck
```

---

## Diagnóstico

El fallo principal es que el sistema mezcla varios espacios de coordenadas:

1. **Coordenadas del screenshot**
   - Ejemplo: `1024x768`.
   - Son las coordenadas que ve el modelo o el OCR.

2. **Coordenadas virtuales del escritorio**
   - Ejemplo: `5206x1080`.
   - Representan el escritorio combinado con varios monitores.

3. **DIP / device-independent pixels**
   - Usados por Electron y por sistemas con escalado DPI.
   - No siempre equivalen a pixeles físicos.

4. **Pixeles físicos**
   - Coordenadas finales usadas por el backend de mouse/teclado.

5. **Offsets por monitor**
   - En setups multimonitor, un monitor puede iniciar en `x` negativa.
   - Ejemplo: `screen (-1286, 494)` puede ser válido si el monitor está a la izquierda del principal, pero debe calcularse con precisión.

6. **Capturas reescaladas**
   - El agente puede estar analizando una imagen de `1024x768`, mientras la pantalla real mide `1366x768`, `1920x1080` o más.
   - Si no se guarda la relación exacta entre captura y display, los clics quedan desfasados.

7. **OCR incompleto**
   - El sistema busca `"MINECRAFT: JAVA EDITION"`, pero OCR devuelve `"Minecraft"` o `"MINECRAFT"`.
   - Esto puede apuntar a un texto parcial, ícono equivocado o zona no clicable.

---

## Principio arquitectónico clave

El modelo **no debe decidir coordenadas finales de pantalla**.

El modelo debe decidir intención o seleccionar un elemento estructurado:

```json
{
  "type": "click_element",
  "element_id": "element-12",
  "reason": "Seleccionar pestaña Minecraft: Java Edition"
}
```

El sistema debe resolver internamente:

```txt
element_id
-> bounding box en screenshot
-> punto central o punto seguro
-> coordenada local del monitor
-> coordenada global del escritorio
-> coordenada física final
-> click mediante backend
```

---

## Objetivo de la implementación

Construir una capa robusta de **desktop grounding** para que el agente pueda controlar mouse y teclado en entornos multimonitor, con resoluciones, escalados y DPI distintos.

El objetivo no es reemplazar inmediatamente `nut.js`, sino bajarlo de nivel:

```txt
Antes:
LLM/OCR -> coordenadas -> nut.js

Después:
LLM -> element_id/intención
ScreenParser -> bbox
CoordinateResolver -> coordenadas finales
InputBackend -> nut.js / backend OS
Verifier -> confirma resultado
```

---

## Arquitectura propuesta

```txt
DesktopAgent
  ├─ ScreenCaptureManager
  ├─ DisplayManager
  ├─ ScreenParser
  │   ├─ OCRParser
  │   ├─ VisualParser
  │   └─ AccessibilityParser / futuro
  ├─ CoordinateResolver
  ├─ InputBackend
  │   ├─ NutInputBackend
  │   ├─ RobotGoInputBackend / opcional
  │   └─ OS-specific adapters / futuro
  ├─ ActionPlanner
  ├─ ActionExecutor
  └─ ActionVerifier
```

---

## Módulo 1 — DisplayManager

### Objetivo

Centralizar la lectura de monitores, DPI, escalado, bounds, offsets y cambios de display.

### Responsabilidades

- Leer displays disponibles desde Electron.
- Guardar `id`, `bounds`, `workArea`, `scaleFactor`, `rotation`.
- Detectar cambios de monitor/resolución.
- Calcular escritorio virtual.
- Determinar en qué monitor cae un punto.
- Determinar qué monitor contiene la ventana activa o la captura actual.
- Evitar que otros módulos calculen displays por su cuenta.

### Interfaz sugerida

```ts
export interface DisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplaySnapshot {
  id: string;
  label?: string;
  boundsDip: DisplayBounds;
  workAreaDip: DisplayBounds;
  scaleFactor: number;
  rotation: number;
  isPrimary: boolean;
}

export interface VirtualDesktopSnapshot {
  displays: DisplaySnapshot[];
  virtualBoundsDip: DisplayBounds;
  capturedAt: string;
}

export interface DisplayManager {
  getSnapshot(): VirtualDesktopSnapshot;
  getDisplayById(id: string): DisplaySnapshot | null;
  getDisplayForPointDip(point: Point): DisplaySnapshot | null;
  getPrimaryDisplay(): DisplaySnapshot;
}
```

### Criterios de aceptación

- El sistema puede listar todos los monitores con sus bounds.
- Si hay un monitor a la izquierda del principal, se aceptan coordenadas `x` negativas.
- Se registra en logs qué display se usó para cada acción.
- Ningún módulo calcula offsets de monitor manualmente fuera de `DisplayManager`.

---

## Módulo 2 — ScreenCaptureManager

### Objetivo

Capturar pantalla o ventana manteniendo metadatos exactos de relación entre screenshot y display real.

### Problema actual

El log muestra cambios de:

```txt
screenshot 1024x768 -> virtual 1920x1080
screenshot 1024x768 -> virtual 1366x768
```

Esto indica que la captura está reescalada o asociada dinámicamente a displays distintos sin un contrato estable.

### Requerimiento

Toda captura debe devolver imagen + metadata.

### Interfaz sugerida

```ts
export interface ScreenshotFrame {
  id: string;
  imageBuffer: Buffer;
  widthPx: number;
  heightPx: number;

  source: {
    type: "display" | "window" | "region";
    displayId?: string;
    windowId?: string;
  };

  display: DisplaySnapshot;

  coordinateMapping: {
    screenshotToDisplayScaleX: number;
    screenshotToDisplayScaleY: number;
    displayToScreenshotScaleX: number;
    displayToScreenshotScaleY: number;
  };

  capturedAt: string;
}
```

### Reglas

- No se debe pasar un screenshot al modelo sin guardar su metadata.
- No se debe convertir un punto de screenshot a pantalla si no existe `ScreenshotFrame`.
- No se debe asumir que `1024x768` equivale al tamaño real del display.
- Cada screenshot debe saber si representa:
  - Display completo.
  - Ventana.
  - Región.
  - Imagen reescalada para el modelo.

### Criterios de aceptación

- Cada acción de click referencia el `screenshotFrame.id`.
- Se puede reproducir el cálculo de coordenadas desde logs.
- Si cambia la resolución o monitor, se invalida el frame anterior.

---

## Módulo 3 — ScreenParser

### Objetivo

Convertir la pantalla en una lista de elementos estructurados para que el LLM no tenga que adivinar coordenadas.

### Resultado esperado

El parser debe producir algo similar a:

```ts
export interface ParsedElement {
  id: string;
  type: "button" | "text" | "input" | "icon" | "tab" | "menuitem" | "unknown";
  label?: string;
  confidence: number;
  bboxScreenshotPx: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  clickablePointScreenshotPx?: {
    x: number;
    y: number;
  };
  source: "ocr" | "vision" | "accessibility" | "dom" | "heuristic";
}
```

### Fuentes de parseo

#### 1. OCR actual

Mantener OCR, pero no usarlo como única fuente de verdad.

Problemas actuales:

- Busca `MINECRAFT: JAVA EDITION`.
- Encuentra solo `MINECRAFT` o `Minecraft`.
- Puede hacer clic sobre un texto parcial, no sobre el botón/pestaña completa.

Mejora requerida:

- Asociar palabras cercanas en una misma línea o bloque.
- Expandir bounding box del texto hacia el contenedor visual.
- Penalizar coincidencias parciales cuando se busca una frase completa.
- Permitir ranking por similitud, no primera coincidencia.

#### 2. Visual parser / OmniParser-style

Integrar un parser visual que detecte:

- Botones.
- Íconos.
- Campos de texto.
- Menús.
- Tabs.
- Contenedores clicables.

Puede ser una integración futura con OmniParser o un servicio local/externo. La implementación debe dejar la interfaz preparada.

#### 3. Accessibility parser

Para Windows/macOS/Linux se puede agregar una capa futura que use APIs de accesibilidad del sistema cuando estén disponibles.

No debe ser requisito inicial, pero la arquitectura debe permitirlo.

### Criterios de aceptación

- El LLM recibe una lista de elementos con `id`, `label`, `type`, `bbox`.
- Las acciones preferidas son por `element_id`.
- Las coordenadas manuales son fallback, no camino principal.
- Cada elemento conserva su fuente: OCR, visión, accesibilidad, etc.

---

## Módulo 4 — CoordinateResolver

### Objetivo

Resolver de forma confiable coordenadas entre screenshot, display local, escritorio virtual y pixel físico.

Este es el módulo más importante para corregir el bug actual.

### Espacios de coordenadas obligatorios

```ts
export type CoordinateSpace =
  | "screenshot_px"
  | "display_local_px"
  | "screen_dip"
  | "screen_physical_px";
```

### Interfaz sugerida

```ts
export interface Point {
  x: number;
  y: number;
}

export interface ResolvedPoint {
  screenshotPx: Point;
  displayLocalPx: Point;
  screenDip: Point;
  screenPhysicalPx: Point;
  display: DisplaySnapshot;
  frameId: string;
}

export interface CoordinateResolver {
  resolveScreenshotPoint(
    frame: ScreenshotFrame,
    point: Point
  ): ResolvedPoint;

  resolveElementCenter(
    frame: ScreenshotFrame,
    element: ParsedElement
  ): ResolvedPoint;

  resolveElementSafePoint(
    frame: ScreenshotFrame,
    element: ParsedElement
  ): ResolvedPoint;
}
```

### Fórmula conceptual

Para captura de display completo:

```txt
displayLocalPx.x = screenshotPoint.x * screenshotToDisplayScaleX
displayLocalPx.y = screenshotPoint.y * screenshotToDisplayScaleY

screenDip.x = display.boundsDip.x + displayLocalPx.x / display.scaleFactor
screenDip.y = display.boundsDip.y + displayLocalPx.y / display.scaleFactor

screenPhysicalPx.x = screenDip.x * display.scaleFactor
screenPhysicalPx.y = screenDip.y * display.scaleFactor
```

La fórmula real puede variar según backend, OS y tipo de captura. Por eso debe estar encapsulada y testeada.

### Reglas

- Prohibido convertir coordenadas fuera de `CoordinateResolver`.
- Prohibido usar offsets hardcodeados.
- Prohibido inferir escala a partir de logs ambiguos si ya existe metadata del frame.
- Si el frame no tiene display asociado, la acción debe fallar de forma controlada.
- Si el punto cae fuera del display, cancelar o recalcular.

### Criterios de aceptación

- Los clics en monitores con `x` negativa funcionan.
- Los clics en monitores con DPI diferente funcionan.
- Los clics en screenshots reescalados funcionan.
- Los logs muestran todas las conversiones.
- Los tests cubren:
  - Un monitor 1920x1080 scale 1.
  - Un monitor 1366x768 scale 1.
  - Dos monitores, uno a la izquierda con `x` negativa.
  - Monitor scale 1.25.
  - Monitor scale 1.5.
  - Screenshot downscaled a 1024px de ancho.

---

## Módulo 5 — InputBackend

### Objetivo

Abstraer el backend que ejecuta acciones de mouse y teclado.

Actualmente se usa `nut.js`. Puede mantenerse como backend inicial.

### Interfaz sugerida

```ts
export interface InputBackend {
  moveMouse(point: Point): Promise<void>;
  click(point: Point, options?: ClickOptions): Promise<void>;
  doubleClick(point: Point): Promise<void>;
  rightClick(point: Point): Promise<void>;

  keyPress(key: string): Promise<void>;
  typeText(text: string): Promise<void>;

  scroll(deltaX: number, deltaY: number): Promise<void>;

  getName(): string;
}
```

### Backends posibles

1. `NutInputBackend`
   - Mantener como default.
   - Debe recibir coordenadas ya resueltas.

2. `RobotGoInputBackend`
   - Evaluar como alternativa.
   - Útil para bajo nivel, pero revisar compatibilidad por plataforma.

3. `PlatformInputBackend`
   - Futuro:
     - Windows: Win32 / UIAutomation / SendInput.
     - macOS: Accessibility permissions / CGEvent.
     - Linux X11: xdotool / XTest.
     - Linux Wayland: ydotool / libei / portales.

### Criterios de aceptación

- El backend no calcula coordenadas.
- El backend recibe `screenPhysicalPx` o el espacio requerido, documentado por plataforma.
- Se puede cambiar backend sin modificar el planner.
- El log indica qué backend ejecutó cada acción.

---

## Módulo 6 — Action schema

### Objetivo

Evitar que el LLM trabaje con coordenadas absolutas cuando puede trabajar con elementos.

### Acciones actuales a evitar como primera opción

```json
{
  "type": "click",
  "x": 60,
  "y": 300
}
```

### Acciones recomendadas

```ts
export type AgentAction =
  | {
      type: "click_element";
      elementId: string;
      reason?: string;
    }
  | {
      type: "click_text";
      text: string;
      matchMode: "exact" | "contains" | "fuzzy";
      reason?: string;
    }
  | {
      type: "click_point";
      x: number;
      y: number;
      coordinateSpace: "screenshot_px";
      reason?: string;
      fallbackOnly: true;
    }
  | {
      type: "key";
      key: string;
      reason?: string;
    }
  | {
      type: "type";
      text: string;
      reason?: string;
    }
  | {
      type: "wait_for_change";
      timeoutMs: number;
      reason?: string;
    };
```

### Reglas

- `click_element` es la acción preferida.
- `click_text` debe resolver a un `ParsedElement`.
- `click_point` solo se permite como fallback explícito.
- Nunca aceptar coordenadas de pantalla física generadas por el LLM.
- Si el LLM devuelve coordenadas, se interpretan como `screenshot_px`, no como `screen_px`.

### Criterios de aceptación

- El agente puede completar acciones usando `elementId`.
- El agente puede explicar por qué eligió un elemento.
- Las coordenadas absolutas quedan restringidas a fallback.

---

## Módulo 7 — ActionExecutor

### Objetivo

Ejecutar acciones con validación y recuperación inteligente.

### Flujo recomendado

```txt
1. Recibir acción del agente.
2. Si acción es por elemento:
   - Buscar elemento en ParsedScreen.
   - Calcular safe point.
   - Resolver coordenadas.
   - Ejecutar click.
3. Capturar pantalla después de la acción.
4. Verificar si hubo cambio esperado.
5. Si no hubo cambio:
   - No repetir infinitamente el mismo click.
   - Reparsear pantalla.
   - Elegir otra estrategia.
```

### Puntos seguros de clic

No siempre conviene hacer clic en el centro exacto del bbox. Implementar:

- Centro del bbox.
- Centro visual expandido.
- Punto dentro de área no transparente.
- Punto ligeramente desplazado si el centro cae sobre texto no interactivo.
- Para tabs/list items: punto medio vertical + margen izquierdo/derecho razonable.

### Criterios de aceptación

- Si la pantalla no cambia después de 2 intentos, no repetir la misma acción.
- El sistema registra `actionAttemptId`.
- Se puede comparar frame anterior vs frame posterior.
- El sistema explica por qué escaló a recuperación.

---

## Módulo 8 — ActionVerifier

### Objetivo

Evitar loops donde el agente repite clics sin efecto.

### Verificaciones mínimas

- Cambio de screenshot.
- Cambio en OCR.
- Cambio en árbol de elementos parseados.
- Cambio de ventana activa.
- Cambio de foco.
- Aparición/desaparición de loading.
- Tiempo máximo de espera.

### Interfaz sugerida

```ts
export interface VerificationResult {
  changed: boolean;
  confidence: number;
  reason: string;
  beforeFrameId: string;
  afterFrameId: string;
}

export interface ActionVerifier {
  verifyActionEffect(
    before: ScreenshotFrame,
    after: ScreenshotFrame,
    action: AgentAction
  ): Promise<VerificationResult>;
}
```

### Reglas

- Después de un click importante, verificar.
- Si no cambió nada, probar alternativa.
- Si falla dos veces, replanificar.
- Si el elemento objetivo sigue visible pero no responde, intentar:
  - Doble click.
  - Enter.
  - Tab navigation.
  - Atajo de teclado.
  - Reparseo visual.

---

## Módulo 9 — Estrategias para apps como Excel

Para productividad, especialmente Excel, no se debe depender solo de clics.

### Orden recomendado

```txt
1. Atajos de teclado.
2. Portapapeles.
3. Pegado masivo con TSV/CSV.
4. Navegación con Tab/Enter/flechas.
5. Accesibilidad del sistema si está disponible.
6. Coordenadas como último recurso.
```

### Ejemplo

En vez de hacer clic celda por celda:

```txt
Nombre    Correo                Estado
Fernando  devops@soflia.ai      Activo
```

Acción recomendada:

```txt
1. Copiar texto TSV al portapapeles.
2. Enfocar Excel.
3. Click en celda inicial.
4. Ctrl+V / Cmd+V.
5. Verificar que la tabla apareció.
```

### Criterios de aceptación

- El agente puede pegar una tabla en Excel sin usar cientos de clics.
- Se reduce dependencia de coordenadas.
- Se usan teclas y clipboard como estrategia preferente cuando aplique.

---

## Módulo 10 — Linux, macOS y Windows

### Windows

- `nut.js` puede seguir como backend inicial.
- Evaluar Windows UI Automation como parser/accesibilidad futuro.
- Manejar monitores con coordenadas negativas.
- Cuidar DPI awareness.

### macOS

- Requiere permisos de accesibilidad y screen recording.
- Backend debe detectar permisos faltantes.
- Implementar mensajes claros para el usuario si faltan permisos.

### Linux

Linux debe dividirse en:

#### X11

- Más compatible con automatización global.
- Herramientas tipo XTest/xdotool funcionan mejor.

#### Wayland

- Restricciones fuertes por seguridad.
- Captura e input pueden depender de compositor, PipeWire, portals, ydotool o libei.
- No asumir paridad total con Windows/macOS.
- Implementar detección de sesión:

```txt
XDG_SESSION_TYPE=x11 | wayland
```

### Criterios de aceptación

- El agente detecta plataforma y sesión.
- Si una función está bloqueada por permisos, falla con mensaje claro.
- No se promete compatibilidad total si Wayland/compositor bloquea input global.

---

## Telemetría y logs requeridos

Cada acción debe generar un log estructurado.

### Ejemplo

```json
{
  "actionId": "action-123",
  "type": "click_element",
  "target": {
    "elementId": "element-12",
    "label": "Minecraft: Java Edition",
    "source": "ocr",
    "confidence": 0.82
  },
  "frame": {
    "id": "frame-456",
    "widthPx": 1024,
    "heightPx": 768,
    "displayId": "4058775692"
  },
  "display": {
    "boundsDip": {
      "x": -1366,
      "y": 0,
      "width": 1366,
      "height": 768
    },
    "scaleFactor": 1
  },
  "coordinates": {
    "screenshotPx": {
      "x": 80,
      "y": 295
    },
    "displayLocalPx": {
      "x": 106,
      "y": 295
    },
    "screenDip": {
      "x": -1260,
      "y": 295
    },
    "screenPhysicalPx": {
      "x": -1260,
      "y": 295
    }
  },
  "backend": "nut.js",
  "verification": {
    "changed": false,
    "confidence": 0.21,
    "reason": "No significant visual change after click"
  }
}
```

---

## Tests mínimos requeridos

Crear tests unitarios para `CoordinateResolver`.

### Casos

#### Caso 1 — Monitor único 1920x1080 scale 1

Input:

```txt
screenshot: 960x540
display: 1920x1080 scale 1
point: 480,270
```

Expected:

```txt
screen: 960,540
```

#### Caso 2 — Monitor único 1366x768 scale 1

Input:

```txt
screenshot: 1024x768
display: 1366x768 scale 1
point: 512,384
```

Expected:

```txt
screen approx: 683,384
```

#### Caso 3 — Monitor izquierdo con x negativa

Input:

```txt
display bounds: x=-1366, y=0, width=1366, height=768
screenshot: 1366x768
point: 100,300
```

Expected:

```txt
screen x=-1266, y=300
```

#### Caso 4 — Scale factor 1.25

Input:

```txt
display bounds DIP: 0,0,1536,864
physical approx: 1920x1080
scaleFactor: 1.25
point local physical: 960,540
```

Expected:

```txt
screen DIP approx: 768,432
physical: 960,540
```

#### Caso 5 — Captura reescalada

Input:

```txt
screenshot: 1024x768
display physical: 1920x1080
point: 512,384
```

Expected:

```txt
local physical x=960
local physical y=540
```

---

## Plan de implementación por fases

### Fase 1 — Auditoría del código actual

Buscar archivos relacionados con:

- `DesktopAgent`
- `computer-use-handlers`
- `desktop-agent-service`
- `ocr-service`
- `screenshot-layout`
- `nut.js`
- `click_element_by_name`
- `Coordenadas resueltas`
- `Escala corregida`
- `wait_for_change`
- `stuck`
- `focus_window`

Objetivo:

- Identificar dónde se capturan screenshots.
- Identificar dónde se decide escala.
- Identificar dónde se convierten coordenadas.
- Identificar dónde se ejecuta mouse/keyboard.
- Identificar dónde el LLM decide acciones.

---

### Fase 2 — Introducir tipos compartidos

Crear archivo sugerido:

```txt
src/main/desktop-agent/coordinates/types.ts
```

Incluir:

- `Point`
- `Rect`
- `DisplaySnapshot`
- `VirtualDesktopSnapshot`
- `ScreenshotFrame`
- `ParsedElement`
- `ResolvedPoint`
- `CoordinateSpace`

---

### Fase 3 — Implementar DisplayManager

Archivo sugerido:

```txt
src/main/desktop-agent/display/display-manager.ts
```

Responsabilidades:

- Leer `screen.getAllDisplays()`.
- Normalizar display ids a string.
- Construir virtual bounds.
- Exponer snapshot.
- Escuchar cambios:
  - `display-added`
  - `display-removed`
  - `display-metrics-changed`

---

### Fase 4 — Implementar ScreenshotFrame

Archivo sugerido:

```txt
src/main/desktop-agent/screen/screen-capture-manager.ts
```

Modificar el flujo de captura para que siempre devuelva `ScreenshotFrame`.

Debe incluir:

- ID único.
- Buffer de imagen.
- Width/height real del screenshot.
- Display asociado.
- Mapping screenshot/display.
- Timestamp.

---

### Fase 5 — Implementar CoordinateResolver

Archivo sugerido:

```txt
src/main/desktop-agent/coordinates/coordinate-resolver.ts
```

Debe reemplazar cualquier lógica dispersa de:

- `render`
- `offset`
- `scale`
- `virtual`
- `dip`
- `screen`

El resolver debe ser la única entrada para convertir coordenadas.

---

### Fase 6 — Cambiar acción click por elemento

Modificar el contrato del agente para preferir:

```json
{
  "type": "click_element",
  "elementId": "..."
}
```

En vez de:

```json
{
  "type": "click",
  "x": 60,
  "y": 300
}
```

`click` por coordenadas debe quedar como fallback.

---

### Fase 7 — Mejorar OCR parser

Archivo sugerido:

```txt
src/main/desktop-agent/screen/ocr-screen-parser.ts
```

Mejoras:

- Agrupar palabras en líneas.
- Agrupar líneas en bloques.
- Fuzzy matching con scoring.
- Penalizar coincidencias parciales.
- Expandir bbox de texto hacia zona clicable probable.
- Devolver `ParsedElement[]`.

---

### Fase 8 — Preparar integración visual parser

Archivo sugerido:

```txt
src/main/desktop-agent/screen/visual-screen-parser.ts
```

No es obligatorio implementar OmniParser en esta fase, pero sí dejar interfaz lista.

```ts
export interface ScreenParser {
  parse(frame: ScreenshotFrame): Promise<ParsedScreen>;
}
```

Crear implementación inicial:

```txt
CompositeScreenParser = OCRScreenParser + heurísticas
```

Preparar futuro:

```txt
OmniParserScreenParser
```

---

### Fase 9 — Rehacer ActionExecutor

Archivo sugerido:

```txt
src/main/desktop-agent/actions/action-executor.ts
```

Responsabilidades:

- Recibir acción.
- Resolver target.
- Resolver coordenadas.
- Ejecutar con backend.
- Llamar verifier.
- Evitar loops.

---

### Fase 10 — Implementar ActionVerifier

Archivo sugerido:

```txt
src/main/desktop-agent/actions/action-verifier.ts
```

Comparar:

- Screenshot before/after.
- OCR before/after.
- Parsed elements before/after.
- Ventana activa si existe.
- Timeout.

---

### Fase 11 — Mejorar recuperación de estado atascado

Cambiar comportamiento actual.

Actualmente:

```txt
pantalla sin cambios durante 4 pasos
-> repite clics similares
```

Nuevo comportamiento:

```txt
pantalla sin cambios durante 2 intentos
-> reparsear pantalla
-> descartar elemento fallido temporalmente
-> intentar alternativa
-> usar teclado si aplica
-> pedir confirmación solo si no hay alternativa
```

---

## Prompt sugerido para Claude Code

Usar este prompt dentro del proyecto:

```txt
Necesito que implementes una refactorización del módulo DesktopAgent / Computer Use para hacerlo robusto en escenarios multimonitor, DPI scaling y screenshots reescalados.

Contexto:
La app es Electron + React. El agente no está pensado para automatizar navegadores con Playwright, sino para controlar mouse y teclado del usuario en Windows, Linux y macOS, incluyendo apps externas como Excel, launchers y ventanas del sistema.

Problema actual:
El log muestra que el sistema mezcla coordenadas de screenshot, pantalla virtual, DIP y pixeles físicos. Ejemplos:
- virtual 5206x1080
- screenshot 1024x768 -> virtual 1920x1080
- screenshot 1024x768 -> virtual 1366x768
- clicks resueltos a coordenadas negativas como screen (-1286, 494)
- OCR encuentra texto parcial como "Minecraft" cuando se busca "MINECRAFT: JAVA EDITION"
- el agente repite clics sin cambio visual y queda atascado

Objetivo:
Crear una arquitectura donde el LLM no decida coordenadas finales. El LLM debe seleccionar element_id o intención. El sistema debe convertir element_id -> bbox -> coordenadas finales usando un CoordinateResolver centralizado.

Implementa por fases:
1. Audita el código actual relacionado con DesktopAgent, screenshots, OCR, nut.js, click_element_by_name, escalas, offsets y wait_for_change.
2. Crea tipos compartidos para Point, Rect, DisplaySnapshot, ScreenshotFrame, ParsedElement y ResolvedPoint.
3. Implementa DisplayManager usando Electron screen.getAllDisplays().
4. Modifica captura de pantalla para devolver ScreenshotFrame con metadata completa.
5. Implementa CoordinateResolver como única fuente de conversión de coordenadas.
6. Cambia acciones para preferir click_element con elementId.
7. Mejora OCR parser para devolver ParsedElement[] con bbox, confidence y source.
8. Implementa ActionExecutor con verificación posterior.
9. Implementa ActionVerifier para evitar loops de clics sin efecto.
10. Agrega logs estructurados para cada acción con frame, display, mapping, coordenadas y resultado.
11. Agrega tests unitarios para escenarios de multimonitor, DPI y screenshots reescalados.

Restricciones:
- No reemplaces el objetivo por Playwright. Playwright puede servir para tests, pero no para el Computer Use general.
- No permitas que el LLM genere coordenadas físicas finales.
- No hagas conversiones de coordenadas fuera de CoordinateResolver.
- Mantén nut.js como backend inicial de input, pero encapsulado detrás de InputBackend.
- No hardcodees offsets ni resoluciones.
- Si Wayland/macOS requieren permisos, detecta y reporta con mensajes claros.

Criterios de aceptación:
- El sistema puede hacer click correctamente en monitores con x negativa.
- El sistema puede manejar screenshots reescalados.
- El sistema registra de forma reproducible cómo convirtió un punto.
- El agente prefiere element_id sobre coordenadas.
- Si un click no cambia la pantalla, el agente no repite el mismo click indefinidamente.
- Hay tests para monitor único, multimonitor, scaleFactor 1.25/1.5 y capturas reescaladas.
```

---

## Definition of Done

La implementación se considera completa cuando:

- Existe un `CoordinateResolver` centralizado.
- Toda captura genera un `ScreenshotFrame`.
- Toda acción de click registra:
  - frame usado,
  - display usado,
  - bbox si aplica,
  - punto en screenshot,
  - punto local display,
  - punto DIP,
  - punto físico,
  - backend usado,
  - resultado de verificación.
- El agente puede ejecutar acciones por `element_id`.
- Los clicks por coordenadas quedan marcados como fallback.
- Se reducen loops de acciones repetidas sin efecto.
- Existen tests unitarios de coordenadas.
- El sistema no depende de una sola resolución ni de un solo monitor.
- El sistema está preparado para agregar OmniParser, accesibilidad del sistema o backends OS-specific sin reescribir el agente completo.

---

## Nota final

El problema actual no debe abordarse como “necesitamos una IA que calcule mejor coordenadas”.

La solución correcta es:

```txt
ver pantalla
-> parsear elementos
-> seleccionar elemento
-> resolver coordenadas con metadata real
-> ejecutar input
-> verificar resultado
```

`nut.js` puede seguir siendo útil, pero debe funcionar como **ejecutor final de mouse/teclado**, no como la capa responsable de entender la pantalla ni de resolver coordenadas.
