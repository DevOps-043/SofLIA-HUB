Actúa como un Senior Electron + Vite + Windows Debugging Engineer.

Necesito que analices y corrijas un problema real de arranque en mi proyecto Electron + Vite en Windows.

## Contexto del problema

Proyecto:

- Electron desktop app
- Vite 5.4.21
- Electron 30.5.1
- vite-plugin-electron 0.28.6
- Windows 11
- Node 22.18.0
- npm 11.7.0

Ruta actual del proyecto:
C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB

Síntoma principal:

- `npm run dev` compila correctamente
- Vite levanta correctamente
- Electron parece iniciar
- pero después aparece este error:
  `ERROR: no se encontró el proceso "60112".`
- en ese momento se cierra la terminal y también se cierra la app automáticamente

## Log actual

Microsoft Windows [Versión 10.0.26200.7922]

C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB>npm run dev

> soflia-hub-desktop@0.1.10 dev
> vite

vite v5.4.21 building for development...

watching for file changes...
vite v5.4.21 building for development...

watching for file changes...

VITE v5.4.21 ready in 2652 ms

➜ Local: http://localhost:5173/
➜ Network: use --host to expose
➜ press h + enter to show help

build started...

build started... (x2)
✓ 1 modules transformed.
dist-electron/preload.mjs 18.20 kB │ gzip: 4.20 kB
built in 2067ms.
✓ 1064 modules transformed.
[plugin:vite:reporter] [plugin vite:reporter]
(!) C:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/electron/iris-data-main.ts is dynamically imported by C:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/electron/proactive-service.ts, C:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/electron/proactive-service.ts, C:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/electron/proactive-service.ts but also statically imported by C:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub/SofLIA-HUB/electron/whatsapp-agent.ts, C:/Users/fysg5/OneDrive/Escritorio/Pulse Hub/SofLIA - Hub\SofLIA-HUB/electron/whatsapp-tool-executor.ts, dynamic import will not move module into another chunk.

dist-electron/main.js 0.20 kB │ gzip: 0.16 kB
dist-electron/ocr-service-Db-kBQHi.js 1.77 kB │ gzip: 0.63 kB
dist-electron/document-designer-CTFqlMBW.js 12.06 kB │ gzip: 2.96 kB
dist-electron/presentation-pdf-Bcq5wx4H.js 16.68 kB │ gzip: 4.28 kB
dist-electron/presentation-premium-DnxavGhq.js 36.65 kB │ gzip: 7.56 kB
dist-electron/autodev-sandbox-C-oNgksy.js 124.00 kB │ gzip: 20.73 kB
dist-electron/index-DZtzE9-Y.js 258.20 kB │ gzip: 56.19 kB
dist-electron/index-CNQNE1Y3.js 988.42 kB │ gzip: 188.07 kB
dist-electron/main-DxSrQ6MK.js 1,738.17 kB │ gzip: 394.39 kB
built in 17371ms.

[dotenv@17.3.1] injecting env (10) from .env
[MonitoringService] sharp module not available — screenshot compositing disabled: require is not defined
[dotenv@17.3.1] injecting env (0) from .env
[Main] Loaded .env from: C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB\.env
[CalendarService] Config set: { google: true, microsoft: false }
[MemoryService] Database initialized at C:\Users\fysg5\AppData\Roaming\soflia-hub-desktop\soflia-memory.db
[MemoryHandlers] Registered successfully
[KnowledgeService] Initialized at C:\Users\fysg5\AppData\Roaming\soflia-hub-desktop\knowledge
[PathMemory] PATHS.md existente — cargando rutas clave...
[PathMemory] 4 watcher(s) activos.
[PathMemory] Servicio iniciado — watchers activos + intervalo de 15 min.
[MonitoringHandlers] Registered successfully
[Main] Loaded .env from: C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB\.env
[CalendarService] Config set: { google: true, microsoft: false }
[MemoryService] Database initialized at C:\Users\fysg5\AppData\Roaming\soflia-hub-desktop\soflia-memory.db
[MemoryHandlers] Registered successfully
[KnowledgeService] Initialized at C:\Users\fysg5\AppData\Roaming\soflia-hub-desktop\knowledge
[PathMemory] PATHS.md existente — cargando rutas clave...
[PathMemory] 4 watcher(s) activos.
[PathMemory] Servicio iniciado — watchers activos + intervalo de 15 min.
[MonitoringHandlers] Registered successfully
[MemoryService] Database initialized at C:\Users\fysg5\AppData\Roaming\soflia-hub-desktop\soflia-memory.db
[MemoryHandlers] Registered successfully
[KnowledgeService] Initialized at C:\Users\fysg5\AppData\Roaming\soflia-hub-desktop\knowledge
[PathMemory] PATHS.md existente — cargando rutas clave...
[PathMemory] 4 watcher(s) activos.
[PathMemory] Servicio iniciado — watchers activos + intervalo de 15 min.
[MonitoringHandlers] Registered successfully
[PathMemory] PATHS.md existente — cargando rutas clave...
[PathMemory] 4 watcher(s) activos.
[PathMemory] Servicio iniciado — watchers activos + intervalo de 15 min.
[MonitoringHandlers] Registered successfully
[CalendarHandlers] Registered successfully
[CalendarHandlers] Registered successfully
[GmailHandlers] Registered successfully
[DriveHandlers] Registered successfully
[GChatHandlers] Registered successfully
[AutoDevHandlers] Registered successfully
[UpdaterHandlers] Registrados correctamente
[Updater] Inicializado — polling cada 4h
[TaskScheduler] Inicializado. 0 tareas programadas cargadas.
[AutoDev] Auto-initialized with env API key
ERROR: no se encontró el proceso "60112".

## Hallazgos ya detectados

1. Vite sí compila bien.
2. El problema ocurre después del build, durante el arranque o reinicio del proceso principal de Electron.
3. Hay señales fuertes de que el main process se está inicializando varias veces:
   - `[Main] Loaded .env ...` aparece repetido
   - `MemoryService`, `KnowledgeService`, `PathMemory`, `MonitoringHandlers` aparecen repetidos
4. Ya eliminé archivos como `system-guardian`, pero el error sigue.
5. Eso sugiere que el problema NO está solamente en esos servicios.
6. Sospecha principal:
   - loop de restart / hot reload del main process
   - bootstrap duplicado
   - cleanup que intenta matar un PID viejo o inexistente
   - o algún `taskkill`, `Stop-Process`, `process.kill`, `child_process.exec`, `spawn`, etc. que termina apuntando a un PID inválido
7. No quiero reiniciar el proyecto desde cero si no es necesario.
8. No quiero una actualización masiva ciega a todas las últimas versiones si primero no se aísla la causa.

## Lo que necesito que hagas

Quiero que trabajes directamente sobre el código para aislar y corregir la causa.

### Objetivo principal

Determinar exactamente:

- qué componente está intentando matar procesos
- por qué el main process arranca múltiples veces
- por qué termina cerrándose la app y la terminal
- si el problema viene de `vite-plugin-electron`, del bootstrap de `main.ts`, o de algún servicio con side effects

## Tareas concretas que debes ejecutar

### 1. Inspección completa del repo

Busca en todo el proyecto estas llamadas:

- `taskkill`
- `Stop-Process`
- `process.kill`
- `kill(`
- `child_process`
- `exec(`
- `execFile(`
- `spawn(`
- `fork(`
- `app.quit()`
- `app.exit()`
- `process.exit()`
- listeners de cierre o restart

### 2. Inspección de bootstrap del proceso principal

Revisa:

- `electron/main.ts`
- `vite.config.ts`
- integración con `vite-plugin-electron`
- cualquier archivo importado por `main.ts` que ejecute side effects al importarse

Quiero que verifiques si hay:

- inicializaciones duplicadas
- watchers que se registran más de una vez
- listeners que se montan múltiples veces
- servicios que corren al importar en vez de correr dentro de una función explícita de arranque

### 3. Instrumentación de diagnóstico

Inserta logs detallados al inicio del proceso principal para rastrear PIDs y salidas.

Agrega este tipo de instrumentación o equivalente:

```ts
console.log(
  "[BOOT] pid=",
  process.pid,
  "ppid=",
  process.ppid,
  "argv=",
  process.argv,
);

process.on("exit", (code) => {
  console.log("[PROCESS EXIT]", { pid: process.pid, code });
});

process.on("SIGTERM", () => {
  console.log("[SIGTERM]", process.pid);
});

process.on("SIGINT", () => {
  console.log("[SIGINT]", process.pid);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});
```

Y quiero logs antes de cada inicialización importante:

- dotenv
- MemoryService
- KnowledgeService
- PathMemory
- CalendarService
- MonitoringHandlers
- GmailHandlers
- DriveHandlers
- GChatHandlers
- AutoDev
- Updater
- TaskScheduler

### 4. Agregar guard de bootstrap único

Implementa una protección para que el bootstrap del main process corra una sola vez por proceso, algo equivalente a:

```ts
const g = globalThis as any;

if (g.__SOFLIA_MAIN_BOOTSTRAPPED__) {
  console.log("[BOOT] skipped duplicate bootstrap", process.pid);
} else {
  g.__SOFLIA_MAIN_BOOTSTRAPPED__ = true;
  console.log("[BOOT] first bootstrap", process.pid);

  // inicialización real aquí
}
```

### 5. Agregar control de instancia única

Si no existe, añade protección de single instance con Electron:

```ts
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log("[APP] second instance detected, quitting", process.pid);
  app.quit();
} else {
  app.on("second-instance", () => {
    console.log("[APP] second-instance event", process.pid);
  });
}
```

### 6. Crear prueba mínima de arranque

Quiero que prepares una versión mínima de `main.ts` para aislar el problema, dejando solo:

- `app.whenReady()`
- creación de una `BrowserWindow`
- `loadURL(process.env.VITE_DEV_SERVER_URL!)`

Sin inicializar MemoryService, KnowledgeService, PathMemory, AutoDev, Updater, etc.

Objetivo:

- verificar si el cierre sigue ocurriendo incluso sin servicios
- si sigue ocurriendo, el problema está en integración Electron/Vite/plugin/restart
- si deja de ocurrir, el problema está en uno de los servicios del bootstrap

### 7. Revisar configuración de `vite-plugin-electron`

Analiza si el plugin está reiniciando el proceso principal múltiples veces.
Quiero que revises si conviene temporalmente:

- desactivar auto-start
- usar `onstart`
- controlar el reinicio manualmente
- evitar reinicios automáticos mientras diagnosticamos

### 8. No hagas actualización masiva

No quiero “actualiza todo a latest” como primera respuesta.

Prioridad:

1. aislar causa
2. corregir bootstrap/restart/kill
3. estabilizar
4. luego proponer actualizaciones graduales y justificadas

### 9. Si detectas que algo sí debe actualizarse

Hazlo de forma mínima y razonada.
Ejemplo aceptable:

- actualizar solo `vite-plugin-electron`
- o alinear Node a 20.19.x para una prueba controlada

Pero no quiero un upgrade masivo a ciegas.

## Resultado esperado

Quiero que me entregues exactamente esto:

1. **Diagnóstico técnico probable**
   - cuál es la causa más probable
   - por qué
   - qué evidencia del código y del log lo respalda

2. **Lista exacta de archivos que debes modificar**

3. **Cambios concretos**
   - diff o bloques completos listos para pegar
   - no solo explicación teórica

4. **Plan de prueba paso a paso**
   - qué ejecutar primero
   - qué log esperar
   - cómo saber si ya se aisló la causa

5. **Plan de rollback**
   - cómo revertir los cambios si algo sale mal

## Importante

- No me digas que reinicie el proyecto desde cero salvo que sea absolutamente necesario y lo justifiques con evidencia.
- No supongas que el problema es solo de Vite, porque Vite sí compila.
- No supongas que el problema es solo de Node 22.
- Concéntrate en:
  - restart loop
  - bootstrap duplicado
  - proceso principal Electron reiniciado
  - cleanup que mata PID inexistente
  - side effects en imports
  - watchers/handlers registrados varias veces

Empieza revisando `electron/main.ts`, `vite.config.ts` y cualquier uso de kill/spawn/exec en todo el repo. Luego propón e implementa los cambios mínimos necesarios.
