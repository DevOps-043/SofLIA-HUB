# Prompt para Claude Code — Depuración de arranque en SofLIA HUB

Actúa como **Senior Electron + Vite + Windows Native Modules Debugging Engineer**.

Necesito que **analices y corrijas** un problema real de arranque en mi proyecto **Electron + Vite** en Windows, trabajando **directamente sobre el código** y proponiendo **cambios mínimos, concretos y justificados**.

---

## 1) Contexto actual del proyecto

Proyecto:

- App desktop con **Electron**
- Frontend con **Vite**
- Windows 11
- Ruta actual del repo:
  `C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB`

Versiones observadas en el entorno:

- **Node:** `22.18.0`
- **npm:** `11.7.0`
- **Vite:** en el log actual aparece `v7.3.1`
- **Electron:** revisar en `package.json` la versión exacta actualmente instalada

Importante:

- El proyecto está en **OneDrive**
- La ruta contiene **espacios**
- Hay módulos nativos como `better-sqlite3` y posiblemente `active-win`

---

## 2) Síntoma principal

Al ejecutar:

```bash
npm run dev
```

ocurre esto:

- Vite compila correctamente
- Electron arranca
- El proceso principal comienza bootstrap
- Luego la app se cierra automáticamente
- La terminal también termina mostrando errores relacionados con el proceso principal

---

## 3) Evidencia más reciente y más importante

### Log más relevante

```text
C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB>npm run dev

> soflia-hub-desktop@0.1.10 dev
> vite

  VITE v7.3.1  ready in 558 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
vite v7.3.1 building client environment for development...

watching for file changes...
vite v7.3.1 building client environment for development...

watching for file changes...

build started...

build started... (x2)
✓ 1 modules transformed.
dist-electron/preload.mjs  18.20 kB │ gzip: 4.20 kB
built in 3003ms.
✓ 658 modules transformed.
...
[BOOT] INICIANDO SOFLIA HUB — PID: 19548, PPID: 31740
[dotenv@17.3.1] injecting env (10) from .env
[MonitoringService] sharp module not available — screenshot compositing disabled: require is not defined
[dotenv@17.3.1] injecting env (0) from .env
[Main] Entorno cargado desde: C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB\.env
(node:19548) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
(node:19548) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
[BOOT] App ready. Initializing subsystems...
[MonitoringHandlers] Registered successfully
[CalendarHandlers] Registered successfully
[GmailHandlers] Registered successfully
[DriveHandlers] Registered successfully
[GChatHandlers] Registered successfully
[AutoDevHandlers] Registered successfully
[MemoryHandlers] Registered successfully
[UpdaterHandlers] Registrados correctamente
[MemoryService] Failed to initialize database: The module '\\?\C:\Users\fysg5\OneDrive\Escritorio\Pulse Hub\SofLIA - Hub\SofLIA-HUB\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 141. This version of Node.js requires
[PathMemory] PATHS.md existente — cargando rutas clave...
[PathMemory] 4 watcher(s) activos.
[PathMemory] Servicio iniciado — watchers activos + intervalo de 15 min.
[Updater] Inicializado — polling cada 4h
[TaskScheduler] Inicializado. 0 tareas programadas cargadas.
ERROR: no se encontró el proceso "19548".
```

### Log posterior después de intentar limpiar y reconstruir

```text
[BOOT FATAL] Error: app.enableSandbox() can only be called before app is ready
    at runBootstrap (.../dist-electron/main.js:60:11)
```

---

## 4) Diagnóstico preliminar ya identificado

Quiero que partas de estas hipótesis, pero que las **verifiques en el código**:

1. **El error “no se encontró el proceso <PID>” es secundario**, no la causa raíz.
   - El PID mostrado corresponde al **main process de Electron**.
   - El proceso principal probablemente **ya murió** y luego algo intenta cerrarlo otra vez.

2. Hay una causa real más fuerte previa:
   - **`better-sqlite3` fue compilado contra otro ABI / NODE_MODULE_VERSION**
   - por eso `MemoryService` falla al cargar la base de datos.

3. Después apareció otro crash directo:
   - **`app.enableSandbox() can only be called before app is ready`**
   - eso indica que en `electron/main.ts` o en el bootstrap se está llamando `app.enableSandbox()` demasiado tarde.

4. Adicionalmente, ya se intentó correr:

```bash
rmdir /s /q node_modules
del package-lock.json
npm install
npm i -D @electron/rebuild
npx electron-rebuild -f -w better-sqlite3
```

pero el rebuild falló con:

```text
Error: Could not find any Visual Studio installation to use
```

y además avisó:

```text
Attempting to build a module with a space in the path
```

5. Eso sugiere que también hay un problema de entorno Windows para compilar módulos nativos:
   - falta **Visual Studio Build Tools / C++ Build Tools**
   - la ruta con espacios puede empeorar la reconstrucción de `node-gyp`

---

## 5) Lo que necesito que hagas exactamente

### A. Analiza el código y localiza la causa real

Revisa al menos:

- `electron/main.ts`
- `vite.config.ts`
- `package.json`
- inicialización de `MemoryService`
- cualquier carga de `better-sqlite3`
- cualquier llamada a:
  - `app.enableSandbox()`
  - `app.whenReady()`
  - `app.on('ready')`
  - `app.quit()`
  - `app.exit()`
  - `process.exit()`
  - `process.kill()`
  - `child_process.exec/spawn`
  - `taskkill`
  - `Stop-Process`

### B. Corrige el orden del bootstrap

Necesito que verifiques si `app.enableSandbox()` está mal ubicado.

Si existe, debe quedar **antes** de `app.whenReady()`.

Quiero que propongas el cambio exacto, no solo la explicación.

### C. Aísla el problema de módulos nativos

Quiero que revises cómo está cargándose `better-sqlite3` y propongas una de estas rutas, con el menor cambio posible:

1. **rebuild correcto para Electron**
2. **carga lazy / protegida** para que no tumbe todo el bootstrap
3. **desactivar temporalmente `MemoryService`** mientras se estabiliza el arranque

### D. Determina si el crash principal actual es:

- por sandbox mal ubicado,
- por `better-sqlite3`,
- por ambos en cadena,
- o por otra cosa adicional.

### E. Propón parches concretos

No quiero teoría solamente.
Quiero:

- diffs
- bloques listos para pegar
- archivos exactos a tocar

---

## 6) Requisitos de tu respuesta

Tu respuesta debe venir estructurada exactamente así:

### 1. Diagnóstico técnico probable

Explica:

- cuál es la causa raíz más probable
- cuál es el error secundario
- cuál es el orden de fallos más probable durante el arranque

### 2. Archivos a modificar

Lista exacta de archivos.

### 3. Cambios concretos

Parches o código listo para pegar.

### 4. Plan de prueba paso a paso

Qué ejecutar después de aplicar cada cambio.

### 5. Plan de rollback

Cómo revertir si algo sale mal.

---

## 7) Restricciones importantes

- **No propongas reiniciar el proyecto desde cero** salvo que haya evidencia técnica contundente.
- **No propongas actualizar todo a latest a ciegas** como primera solución.
- Prioriza:
  1. aislar la causa
  2. corregir el bootstrap
  3. estabilizar el arranque
  4. luego sugerir actualizaciones graduales

---

## 8) Lo que sospecho actualmente y quiero que valides

Mi sospecha actual es:

1. Electron sí arranca.
2. El main process entra al bootstrap.
3. `app.enableSandbox()` está siendo llamado tarde y provoca un crash fatal.
4. Aun si eso se corrige, `better-sqlite3` seguirá fallando por ABI incompatible.
5. El error “no se encontró el proceso <PID>” ocurre después, cuando alguna capa intenta cerrar un proceso que ya murió.

Valida o corrige esta hipótesis usando el código real.

---

## 9) Acción concreta esperada

Empieza inspeccionando primero:

- `electron/main.ts`
- `package.json`
- `vite.config.ts`
- `MemoryService`

Luego devuélveme:

- **el diagnóstico más probable**
- **el patch mínimo correcto**
- **el orden de aplicación recomendado**

No me respondas con generalidades. Quiero una respuesta orientada a **editar código ya**.
