# Comparación entre Electron 43 y Electron 39

## Resumen ejecutivo

La diferencia entre Electron 39 y Electron 43 es importante porque no solo cambia la versión de Electron. También se actualizan Chromium, Node.js, V8, varias APIs nativas, el comportamiento de instalación, algunas características de seguridad y la compatibilidad con sistemas operativos.

Electron 43 incorpora los cambios acumulados de Electron 40, 41 y 42, por lo que la migración debe revisarse como un salto de varias versiones y no únicamente como un cambio de número en `package.json`.

## Comparación de componentes principales

| Componente | Electron 39 | Electron 43.0.0 | Electron 43.3.0 (fijado aquí) |
|---|---:|---:|---:|
| Chromium | 142.0.7444.52 | 150.0.7871.46 | 150.0.7871.212 |
| Node.js incluido | 22.20.0 | 24.17.0 | 24.18.1 |
| V8 | 14.2 | 15.0 | 15.0.245.23 |
| ABI de módulos nativos | 140 | 148 | 148 |
| Estado de soporte | Fuera de soporte desde el 5 de mayo de 2026 | Línea soportada hasta enero de 2027 | Última estable |
| Cambios acumulados | Versión inicial de la línea 39 | Incluye cambios de Electron 40, 41 y 42 | — |

> Las versiones, fechas y características deben contrastarse con las notas de lanzamiento oficiales de Electron antes de utilizarlas como referencia contractual o de producción. La última columna se verificó contra `releases.electronjs.org` para la versión que este repositorio tiene fijada.

## 1. Actualización de Chromium, Node.js y V8

Electron 43 incluye:

- Chromium 150 en lugar de Chromium 142.
- Node.js 24 en lugar de Node.js 22.
- V8 15.0 en lugar de V8 14.2.

Estas actualizaciones proporcionan una plataforma web más reciente, nuevas capacidades de JavaScript, correcciones de seguridad y una mejor compatibilidad con páginas web y estándares modernos.

El cambio de Node.js puede afectar a las herramientas de compilación, las dependencias y los módulos nativos utilizados por la aplicación.

### Módulos nativos

Si el proyecto utiliza módulos nativos como los siguientes, normalmente será necesario recompilarlos para la nueva versión de Electron mediante `@electron/rebuild`:

- `sqlite3`
- `sharp`
- `serialport`
- `better-sqlite3`
- Módulos propios en C o C++

Ejemplo general:

```bash
npm install --save-dev @electron/rebuild
npx electron-rebuild
```

La necesidad exacta de recompilación dependerá de las dependencias, la arquitectura del sistema operativo y la configuración del proyecto.

## 2. Mejoras de rendimiento durante el inicio

Electron 43 incorpora optimizaciones orientadas al arranque de las aplicaciones:

- El proceso principal utiliza un snapshot integrado de Node.js.
- Los bundles del framework y los scripts `preload` pueden utilizar bytecode compilado en caché.
- El arranque del renderer con sandbox reduce operaciones IPC bloqueantes.
- Los stack traces de los scripts `preload` muestran rutas y líneas más precisas.

Estas mejoras pueden reducir el tiempo de inicio y mejorar el diagnóstico de errores. El beneficio real depende de la cantidad de código, ventanas, módulos y servicios que cargue cada aplicación.

## 3. Cambio en el comportamiento de instalación

A partir de Electron 42, incluido en el salto hacia Electron 43, el paquete `electron` dejó de descargar el binario mediante un script `postinstall` como ocurría tradicionalmente.

### Flujo habitual en Electron 39

En Electron 39, el flujo tradicional era:

```bash
npm install electron
```

Durante la instalación, el paquete descargaba automáticamente el binario de Electron.

### Flujo posible en Electron 43

En Electron 43, la descarga puede realizarse cuando Electron se ejecuta por primera vez o mediante una instalación manual:

```bash
npm install electron --save-dev --ignore-scripts
npx install-electron
```

Este cambio es especialmente relevante para:

- Pipelines de CI/CD.
- Instalaciones sin acceso a Internet.
- Builds reproducibles.
- Entornos que utilizan `npm install --ignore-scripts`.
- Sistemas que bloquean scripts `postinstall`.

También dejó de estar disponible la variable `ELECTRON_SKIP_BINARY_DOWNLOAD`.

### Revisión recomendada

Al migrar, se debe verificar:

1. Cómo se descarga el binario de Electron.
2. Si los agentes de CI tienen acceso a la red.
3. Si se utilizan caches de dependencias.
4. Si la organización bloquea scripts de instalación.
5. Si los builds se ejecutan con `npm install --ignore-scripts`.
6. Si el empaquetador espera encontrar el binario en una ubicación específica.

## 4. Cambios en las notificaciones de macOS

Electron 42 cambió el sistema de notificaciones de macOS de `NSUserNotification` a `UNNotification`. Este comportamiento está incluido cuando se utiliza Electron 43.

### Impacto principal

La aplicación debe estar firmada digitalmente para que las notificaciones funcionen correctamente. En una build no firmada, el objeto `Notification` puede emitir un evento `failed`.

Electron 43 también incorpora APIs para:

- Consultar el historial de notificaciones.
- Eliminar una notificación específica.
- Eliminar todas las notificaciones.
- Eliminar grupos de notificaciones.
- Asignar identificadores y grupos.

### Qué probar

Las aplicaciones que utilicen notificaciones deben probarse en:

- Build de desarrollo.
- Build firmada.
- Build distribuida.
- Diferentes versiones compatibles de macOS.
- Escenarios de permisos denegados.
- Notificaciones con identificadores y grupos.

## 5. Cambios visuales y de ventanas en Linux

Electron 41 mejoró el soporte para Wayland, incluyendo:

- Sombras en ventanas sin marco.
- Mejores límites para redimensionar ventanas.
- Mejor integración con escritorios Linux modernos.

En Electron 43, las ventanas sin marco en Linux utilizan esquinas redondeadas por defecto cuando el entorno gráfico lo permite.

Para conservar esquinas cuadradas puede utilizarse:

```javascript
const win = new BrowserWindow({
  frame: false,
  roundedCorners: false
});
```

También se eliminó el soporte de `showHiddenFiles` en la API `dialog` para Linux.

### Aspectos que deben validarse

- Apariencia en Wayland.
- Apariencia en X11.
- Sombras y bordes de ventanas sin marco.
- Redimensionamiento.
- Esquinas redondeadas.
- Diálogos de selección de archivos.
- Comportamiento en distintos entornos de escritorio.

## 6. Cambios en Offscreen Rendering

Electron 39 añadió soporte para:

- Formato `RGBAF16`.
- Espacio de color HDR scRGB.
- Mejoras para el renderizado fuera de pantalla.

Sin embargo, Electron 42 modificó el valor predeterminado del factor de escala de Offscreen Rendering. Antes se utilizaba el factor de escala de la pantalla principal; desde Electron 42, el valor predeterminado es `1.0`.

Si la aplicación utiliza capturas, streaming, procesamiento de vídeo o renderizado fuera de pantalla, conviene establecer explícitamente el factor de escala:

```javascript
const win = new BrowserWindow({
  webPreferences: {
    offscreen: {
      deviceScaleFactor: 1.0
    }
  }
});
```

Esto ayuda a evitar cambios inesperados en:

- Resolución de capturas.
- Tamaño de frames.
- Coordenadas visuales.
- Escalado de elementos.
- Calidad de vídeo.
- Integración con sistemas de visión o automatización.

## 7. Acceso al Clipboard desde el renderer

Electron 40 marcó como obsoleto el acceso directo a `clipboard` desde el proceso renderer.

### Patrón antiguo

```javascript
// Renderer
const { clipboard } = require('electron');
clipboard.writeText('Texto');
```

### Patrón recomendado

Se recomienda mover el acceso al proceso `preload` y exponer únicamente las funciones necesarias mediante `contextBridge`.

```javascript
// preload.js
const { contextBridge, clipboard } = require('electron');

contextBridge.exposeInMainWorld('systemClipboard', {
  writeText: (text) => clipboard.writeText(text)
});
```

Después, el renderer puede utilizar la API expuesta:

```javascript
window.systemClipboard.writeText('Texto');
```

En Electron 43 el acceso antiguo todavía puede funcionar, pero se considera una ruta de migración importante porque podría eliminarse en versiones posteriores.

### Recomendaciones de seguridad

- Mantener `contextIsolation` habilitado.
- Evitar exponer directamente módulos completos de Electron.
- Exponer solo funciones concretas mediante `contextBridge`.
- Validar los datos recibidos desde el renderer.
- Evitar habilitar `nodeIntegration` sin una justificación clara.

## 8. Cambio en la ubicación predeterminada de descargas

En Electron 43, las descargas se guardan por defecto en la carpeta `Downloads` o `Descargas` del usuario. Si esa carpeta no existe, se utiliza el directorio Home.

Esto puede afectar a aplicaciones que:

- Dependían de una ubicación diferente.
- Esperaban que el usuario eligiera siempre el destino.
- Supervisaban una carpeta específica.
- Procesaban automáticamente los archivos descargados.
- Mostraban rutas predeterminadas personalizadas.

### Revisión recomendada

La aplicación debe comprobar explícitamente la ruta de descarga si el flujo depende de una ubicación concreta. No conviene asumir que la carpeta utilizada por versiones anteriores seguirá siendo la misma.

## 9. Nuevas APIs y capacidades en Electron 43

Entre las adiciones o mejoras relevantes se encuentran:

- `webContents.clone()`.
- Stack trace de JavaScript en reportes de errores por falta de memoria del renderer.
- `app.getApplicationInfoForProtocol()` en Linux.
- APIs avanzadas para administrar notificaciones en macOS.
- `accessibilityLabel` para mejorar la accesibilidad de menús.
- Soporte para permitir extensiones de Chrome en protocolos personalizados.
- `globalShortcut.setSuspended()`.
- `globalShortcut.isSuspended()`.
- `view.setBackgroundBlur()`.
- Copia y guardado de frames de vídeo mediante `webContents`.
- Soporte adicional para texturas compartidas y formatos de vídeo.
- Perfilado de memoria mediante `contentTracing.enableHeapProfiling()`.

Estas APIs no obligan a modificar una aplicación existente, pero pueden ser útiles para nuevas funcionalidades, diagnósticos, accesibilidad, vídeo y optimización de recursos.

## 10. WebAuthn, Touch ID y actualizaciones MSIX

Durante las versiones intermedias se añadieron o mejoraron capacidades relacionadas con autenticación y distribución:

- Soporte para WebAuthn con Touch ID en macOS.
- Eventos para seleccionar credenciales WebAuthn.
- Soporte de actualización automática mediante MSIX.
- Autenticación WebSocket mediante el evento `login`.
- Nuevas capacidades para notificaciones interactivas de Windows.

Estas mejoras son especialmente relevantes para:

- Aplicaciones empresariales.
- Sistemas con autenticación biométrica.
- Aplicaciones que utilizan credenciales WebAuthn.
- Distribución corporativa mediante MSIX.
- Flujos de actualización automática.
- Aplicaciones con notificaciones interactivas en Windows.

## 11. Compatibilidad con sistemas de 32 bits

Electron 43 es la última línea que publica binarios precompilados para:

- Windows x86 de 32 bits.
- Linux ARM de 32 bits, `armv7l`.

A partir de Electron 44 esas plataformas dejan de recibir binarios precompilados.

Si la aplicación todavía necesita ejecutarse en equipos de 32 bits, Electron 43 puede ser la última línea disponible para esas arquitecturas. No obstante, debe considerarse el ciclo de soporte de Electron y planificar una migración futura a sistemas de 64 bits.

## 12. Argumentos de Chromium y compatibilidad

Durante la migración se debe revisar el uso de argumentos de Chromium que hayan cambiado o quedado obsoletos.

Un ejemplo es la sustitución de:

```text
--host-rules
```

por:

```text
--host-resolver-rules
```

La revisión debe incluir todos los argumentos personalizados que se pasen mediante `app.commandLine.appendSwitch()` o mecanismos equivalentes.

## 13. Qué puede romperse al migrar de Electron 39 a Electron 43

### 13.1 Módulos nativos

Posibles problemas:

- Binarios compilados contra otra versión de Node.js.
- Errores de ABI.
- Fallos en SQLite.
- Problemas con cámaras o impresoras.
- Fallos en puertos seriales.
- Errores en librerías C o C++.

Acción recomendada:

```bash
npx electron-rebuild
```

Después se deben probar todas las funciones que dependan de módulos nativos.

### 13.2 Sistema de instalación

Posibles problemas:

- El binario no se descarga en CI.
- Los scripts `postinstall` ya no ejecutan el comportamiento esperado.
- El pipeline utiliza `--ignore-scripts`.
- El empaquetador no localiza el binario de Electron.
- La red corporativa bloquea la descarga.

### 13.3 Notificaciones en macOS

Se debe probar:

- Aplicación firmada.
- Aplicación no firmada.
- Permisos de notificación.
- Eventos de error.
- Identificadores.
- Agrupación de notificaciones.

### 13.4 Clipboard

Se deben revisar los accesos directos a `clipboard` desde el renderer y migrarlos a `preload` con `contextBridge`.

### 13.5 Offscreen Rendering

Se debe comprobar que las capturas y los frames no cambien de resolución o escala. Para flujos sensibles a la geometría visual, conviene configurar explícitamente `deviceScaleFactor`.

### 13.6 Ventanas sin marco

Se debe revisar:

- Esquinas redondeadas.
- Sombras.
- Redimensionamiento.
- Wayland.
- X11.
- Coordenadas de controles personalizados.

### 13.7 Diálogos de archivos

Debe eliminarse o sustituirse el uso de `showHiddenFiles` en Linux.

### 13.8 Descargas

Debe confirmarse que la carpeta predeterminada y la lógica de guardado coincidan con lo esperado por la aplicación.

### 13.9 Argumentos de Chromium

Se deben revisar argumentos personalizados y reemplazar aquellos que hayan cambiado de nombre o comportamiento.

### 13.10 Distribución

Debe confirmarse qué arquitecturas se seguirán soportando:

- Windows x64.
- Windows x86.
- macOS Intel.
- macOS Apple Silicon.
- Linux x64.
- Linux ARM64.
- Linux ARM32, si todavía es necesario.

## 14. Lista de comprobación para una migración controlada

### Antes de actualizar

- [ ] Crear una rama exclusiva para la migración.
- [ ] Registrar la versión actual de Electron, Node.js y npm.
- [ ] Crear una copia de seguridad del proyecto.
- [ ] Revisar dependencias directas y transitivas.
- [ ] Identificar módulos nativos.
- [ ] Revisar la configuración de empaquetado.
- [ ] Revisar los pipelines de CI/CD.
- [ ] Registrar las arquitecturas soportadas.
- [ ] Revisar el uso de notificaciones.
- [ ] Revisar el uso de Clipboard.
- [ ] Revisar Offscreen Rendering.
- [ ] Revisar ventanas sin marco.
- [ ] Revisar argumentos personalizados de Chromium.

### Durante la actualización

- [ ] Actualizar la dependencia `electron`.
- [ ] Actualizar el lockfile.
- [ ] Ejecutar la instalación en un entorno limpio.
- [ ] Confirmar la descarga del binario.
- [ ] Ejecutar `electron-rebuild` si existen módulos nativos.
- [ ] Corregir APIs obsoletas.
- [ ] Verificar errores de compilación.
- [ ] Revisar las advertencias de Electron.

### Después de actualizar

- [ ] Ejecutar pruebas unitarias.
- [ ] Ejecutar pruebas de integración.
- [ ] Probar el proceso principal.
- [ ] Probar el renderer.
- [ ] Probar los scripts `preload`.
- [ ] Probar ventanas y menús.
- [ ] Probar notificaciones.
- [ ] Probar Clipboard.
- [ ] Probar descargas.
- [ ] Probar capturas y Offscreen Rendering.
- [ ] Probar autenticación WebAuthn, si aplica.
- [ ] Probar actualizaciones de la aplicación.
- [ ] Probar la distribución en cada sistema operativo.
- [ ] Validar el rendimiento de inicio.
- [ ] Revisar el consumo de memoria.
- [ ] Generar instaladores de prueba.
- [ ] Realizar una prueba manual completa antes de publicar.

## 15. Recomendación según el tipo de proyecto

### Proyecto nuevo

Para un proyecto nuevo, Electron 43 es preferible frente a Electron 39 porque ofrece una base más reciente de Chromium, Node.js y V8, además de mejores capacidades y soporte más actual.

### Proyecto sencillo

Si la aplicación es sencilla, no utiliza módulos nativos y no depende de APIs específicas, la migración probablemente sea relativamente directa. Aun así, deben ejecutarse pruebas de instalación, arranque, ventanas, navegación y empaquetado.

### Proyecto con módulos nativos

Si utiliza SQLite, procesamiento de imágenes, puertos seriales, cámaras, impresoras o módulos C/C++, la migración requiere mayor control. Deben recompilarse los módulos y validarse en cada arquitectura objetivo.

### Aplicación con streaming o visión computacional

Si utiliza capturas, streaming, vídeo o renderizado fuera de pantalla, se debe revisar especialmente el cambio de `deviceScaleFactor` predeterminado y confirmar que no se alteren las resoluciones ni las coordenadas.

### Aplicación empresarial

Si utiliza autenticación, notificaciones, distribución corporativa o actualizaciones automáticas, se deben probar WebAuthn, Touch ID, MSIX, firma digital, permisos y recuperación ante errores.

### Aplicación que soporta equipos antiguos

Si todavía se necesita Windows x86 o Linux ARM de 32 bits, Electron 43 puede ser relevante porque es la última línea con binarios precompilados para esas plataformas. Sin embargo, debe elaborarse un plan para abandonar progresivamente arquitecturas de 32 bits.

## 16. Conclusión

Electron 43 es claramente más moderno y recomendable que Electron 39 para un proyecto nuevo o una aplicación en mantenimiento activo, principalmente por:

- Chromium 150 frente a Chromium 142.
- Node.js 24 frente a Node.js 22.
- V8 15.0 frente a V8 14.2.
- Mejoras de rendimiento al iniciar.
- Mejor soporte para Wayland.
- Mejoras de seguridad y empaquetado.
- Nuevas APIs para notificaciones, WebAuthn, accesibilidad y vídeo.
- Mejoras en diagnóstico y perfilado de memoria.
- Soporte de 32 bits durante la última línea disponible para esas arquitecturas.

La migración no debería limitarse a cambiar el número de versión en `package.json`. Para una aplicación sencilla puede ser un proceso directo, pero para una aplicación con módulos nativos, notificaciones, ventanas sin marco, renderizado fuera de pantalla, autenticación o pipelines personalizados conviene realizar una migración controlada.

La estrategia recomendada es:

1. Crear una rama de migración.
2. Actualizar Electron y las dependencias relacionadas.
3. Recompilar módulos nativos.
4. Revisar APIs obsoletas y cambios de comportamiento.
5. Ejecutar pruebas automatizadas.
6. Validar manualmente cada sistema operativo objetivo.
7. Generar instaladores de prueba.
8. Comprobar rendimiento, memoria, seguridad y distribución.
9. Publicar solo después de completar la validación en vivo.

## 17. Estado verificado de esta migración en Pulse Hub

Esta sección no es teórica: recoge lo que se comprobó sobre este repositorio con
Electron 43.3.0 ya fijado. Distingue lo que se corrigió, lo que no aplica y lo
que sigue bloqueado.

### 17.1 Corregido

| Punto de la guía | Hallazgo en este repositorio | Corrección |
|---|---|---|
| §3 Instalación | `node_modules/electron/dist/` no existía y el paquete `electron` ya no declara ningún script, así que el binario nunca se descargaba. La aplicación no podía arrancar. | El `postinstall` del proyecto ejecuta ahora `install-electron` antes de reconstruir los módulos nativos. |
| §6 Offscreen Rendering | Cuatro ventanas usan `offscreen`. Tres generan PDF con `printToPDF` (salida vectorial, impacto menor); `safe-browser` usa `capturePage`, cuya resolución sí dependía del factor de escala del monitor. | `deviceScaleFactor` fijado explícitamente en los cuatro sitios: la salida deja de depender de la pantalla del equipo y de futuros cambios del valor por omisión. |
| §1 Client Hints (no cubierto por la guía) | La partición del navegador integrado completa las cabeceras `Sec-CH-UA*` derivándolas del User-Agent anunciado. | La versión de Chrome se deriva en tiempo de ejecución, así que el salto de Chromium 142 a 150 no requiere tocar nada. |

### 17.2 No aplica

- **§7 Clipboard desde el renderer:** el renderer no importa `electron` en ningún archivo; el portapapeles ya pasa por `preload` e IPC.
- **§12 Argumentos de Chromium:** el único switch propio es `autoplay-policy`, que no cambió. No se usa `--host-rules`.
- **§5 Diálogos en Linux:** `showHiddenFiles` no se utiliza.
- **§8 Descargas:** no hay manejadores `will-download` ni rutas de descarga asumidas.
- **§4 Notificaciones de macOS y §10 WebAuthn/MSIX:** sin uso en el código actual.

### 17.3 Resuelto: módulos nativos

Este era el único punto que impedía ejecutar la aplicación, y no se resolvía
recompilando como sugiere §13.1 porque en este equipo no hay cadena de
compilación de C++. Los datos verificados eran:

- Electron 43 usa **ABI 148**. `node-abi` lo confirma: Electron 41 → 145,
  Electron 42 → 146, Electron 43 → 148.
- `better-sqlite3` publica binarios precompilados hasta **ABI 146** en su
  versión 12.11.1. Ninguna publicación, incluida la 13.0.3, ofrece ABI 148; de
  hecho la 13.0.3 no publica ningún binario.

En lugar de fijar Electron 42, instalar Visual Studio Build Tools o esperar al
binario, se eliminó la causa: **la persistencia local pasó a `node:sqlite`**, el
módulo que ya viaja dentro del Node incluido en Electron. No hay extensión
compilada contra la ABI de V8, así que el problema no puede repetirse en la
línea 44 ni en las siguientes.

Se comprobó ejecutando el binario real de Electron 43.3.0 que `node:sqlite`
cubre todo lo que el producto usa:

| Capacidad | Resultado |
|---|---|
| `DatabaseSync`, `prepare`, `run`, `get`, `all` | Correcto, con el mismo `{ changes, lastInsertRowid }` |
| FTS5 con `tokenize="porter"` y `MATCH` | Correcto |
| `PRAGMA journal_mode = WAL` | Correcto |
| `ALTER TABLE ... ADD COLUMN` | Correcto |
| Transacciones `BEGIN`/`COMMIT`/`ROLLBACK` | Correcto |

`electron/sqlite/database.ts` conserva la superficie de `better-sqlite3`
(`pragma` y `transaction` no existen en `node:sqlite`) para que los módulos
consumidores no cambiaran de forma. Con la dependencia fuera desaparecieron
también `test-native.mjs` y los scripts de reconstrucción, que existían solo
para intercambiar la ABI entre Node y Electron.

> `node-abi` sigue fijado en `^4.33.0` mediante `overrides`: ya no hace falta
> para SQLite, pero mantiene a `electron-builder` capaz de reconocer Electron 43.

### 17.4 Pendiente de validación manual

Lo anterior se verificó por análisis del código, tipos y metadatos de los
paquetes. No se ha ejecutado la aplicación, así que siguen sin comprobar los
puntos de §14 que exigen ejecución: arranque, ventanas, menús, capturas reales,
generación de PDF, empaquetado e instaladores.

## Referencias indicadas

- [Electron Releases](https://releases.electronjs.org/)
- [Electron 43.0.0](https://releases.electronjs.org/release/v43.0.0)
- [Electron 41.0.0](https://releases.electronjs.org/release/v41.0.0)
- [Electron: Using Native Node Modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- [Electron 40.0](https://www.electronjs.org/blog/electron-40-0)
- [Electron 42.0](https://www.electronjs.org/blog/electron-42-0)
- [Electron 43.0](https://www.electronjs.org/blog/electron-43-0)
