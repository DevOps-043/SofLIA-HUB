# Verificación del instalador propio y la orbe original

## Ajuste posterior: retirar el contorno verde

Se retiró el outline rectangular de foco de `src/installer-orb/orb.css` por
petición del usuario. El teclado conserva una señal discreta bajo el texto de
ayuda; no se modificaron los shaders ni los controles. Las 27 pruebas focalizadas
pasaron y se reconstruyeron ambos EXE. Estos sustituyen las rutas anteriores:

- Vista previa: `C:/Users/fysg5/AppData/Local/Temp/pulse-installer-shell-0GU0dz/Pulse-Hub-Installer-Preview.exe`.
- Instalador de prueba: `C:/Users/fysg5/AppData/Local/Temp/pulse-installer-delivery-6ZsYcU/Pulse-Hub-Windows-0.9.8-Install.exe`.
- SHA-256 del instalador: `066feec428c919039bf624addc37b0707379bc35111736e0456f6c81117b19f9`.
- Motor embebido sin cambios; se mantienen los límites de firma y aceptación.
- Verificación visual nativa: orbe enfocada sin marco; ayuda inferior subrayada.
- Typecheck, lint incremental, arnés, OpenSpec y documentación aprobados para
  este ajuste. La repetición general detectó un fallo en `browser-sqlite-recovery`
  (archivo no modificado por este ajuste); su repetición aislada pasó 32/32.
  No se atribuye ese fallo al CSS ni se declara aprobada esa repetición general.

Estado: verificación local aprobada; pendiente aceptación de release en Windows desechable. No publicado, no firmado ni instalado sobre el equipo del usuario.

## Resultado e identidad

La primera aproximación usó mallas WPF y fue rechazada por el usuario. Se retiró:
el host ahora carga directamente `src/components/orb/OrbCanvas.tsx` y sus
`OrbMesh`, geometría y shaders existentes, sin duplicarlos. Se agregó interacción
por teclado, recentrado, pérdida de captura y control de movimiento al componente
compartido. El logo es `public/assets/Icono.png`, SHA-256
`bca3570898a2b6fae7c9fdaaaece6130c6bcba935aa56c3a901d1d6756b81a48`.

La ventana propia ya se observó nativamente sin marco/páginas NSIS. Se comprobó
visualmente la orbe original, arrastre, pausa y apertura/cierre de opciones sin
que WebView se superponga al panel. Pruebas automatizadas cubren flechas,
límites, doble clic y limpieza de listener. La interfaz visual no acredita por
sí sola una instalación real.

## Comandos y resultados

- `npm run installer:preview`: compilación C#/WPF y bundle Vite de la orbe local.
- `npm run installer:test:native`: 30 comprobaciones correctas; motor inocuo
  con código 23, sin archivos de destino ni instalación. Incluye rutas inválidas,
  hash incorrecto, vacío, cancelación y aislamiento de variables del subproceso.
- Vitest focalizado inicial: 71 pruebas de shell, NSIS y build aislado correctas.
- Vitest adicional: 26 pruebas de orbe compartida, puente gráfico y shell correctas.
- `npm run verify:pr`: aprobado; 3453 pruebas en 320 archivos ejecutados,
  167.91 s, inicio local 10:20:42. Incluye typecheck, lint incremental de 30
  archivos, arnés, supply-chain, 28 cambios OpenSpec y documentación.
- ESLint explícito de los tres scripts nuevos: aprobado; `git diff --check`
  aprobado. El inventario derivado total quedó en 485 archivos de prueba.
- `npm run docs:check`: 301 Markdown activos con enlaces válidos.

## Hallazgos corregidos

- No ejecutar una imagen PE abierta para escritura: cerrar escritura, reabrir
  con solo lectura, verificar otra vez y conservar bloqueo hasta fin del hijo.
- NSIS permite cierre automático de Pulse Hub en modo silencioso: la entrada
  `/pulseShell` rechaza aplicación abierta, conservando el flujo del actualizador
  cuando no se usa ese argumento. El hook requiere declarar `getProcessInfo`,
  `pid` y detección PowerShell que electron-builder omite al personalizarlo.
- WebView creado antes del evento Loaded perdía el contexto UI al esperar:
  inicialización posterior a HWND/Dispatcher corrige InvalidOperationException.
- La carpeta virtual solo publica `content`, no loader ni perfil temporal.
- Sin comandos desde la página: no WebMessageReceived, host objects, navegación
  externa, descargas ni permisos de audio/cámara. Los mensajes son únicamente
  estados gráficos nativos hacia React. El bundle usa `envDir: false`.
- Previsualización identificada como tal y compilada sin payload; sus porcentajes
  o estados de demostración no se presentan como instalación realizada.

## Dependencia gráfica

SDK Microsoft.Web.WebView2 1.0.4191.47 descargado de NuGet oficial, SHA-256 fijado
`f492bbf547d0da329553b6727435b677579b1e9f91cc9e4a1ad029366d5f23d0`;
la firma del loader descargado se comprobó válida con editor Microsoft Corporation.
Su licencia permite redistribución y se incluye en los recursos. Evergreen
152.0.4191.66 estaba presente en este equipo. Según la
[documentación Microsoft](https://learn.microsoft.com/microsoft-edge/webview2/concepts/distribution),
no debe suponerse que todos los equipos Windows tengan el runtime: sin él se
muestra aviso y permanece disponible la instalación, no se descarga por sorpresa.

## Límites y release

- Falta aceptación de instalación/actualización/desinstalación en Windows
  desechable, Authenticode del nuevo EXE y pruebas de DPI/lectores de pantalla.
- Mantener Setup.exe/latest.yml/blockmap para electron-updater; Install.exe es
  una entrada adicional. Nunca sustituir el archivo de actualización por el shell.
- Los temporales gráficos y de build se conservan para inspección. El shell no
  hace borrados recursivos de perfiles, no altera Python del sistema ni datos.
- Los dos primeros empaquetados de esta sesión fallaron por los símbolos NSIS
  del hook personalizado; no son entregables. La repetición con `--prepackaged`
  sobre `pulse-installer-build-QNhwlQ/release/0.9.8/win-unpacked` pasó después
  de corregir el include, sin .env, firma, instalación ni publicación. El reporte
  original fallido se conserva y no se reescribe como éxito.

## Artefactos finales de esta revisión

- Instalador de prueba: `C:/Users/fysg5/AppData/Local/Temp/pulse-installer-delivery-bDng6K/Pulse-Hub-Windows-0.9.8-Install.exe`.
  362706944 bytes, SHA-256
  `1483f3640c2aaec0655d74abef210ae1b1370fb041a36bf194763d22c4902253`.
- Motor NSIS embebido: SHA-256
  `1a43f9b187fc82a56a3348d2d93cf05dba38913e3101a2d5c47c1bc593a6b3c9`.
  El hash del motor se verificó otra vez después de generar el shell.
- Reporte de shell: `C:/Users/fysg5/AppData/Local/Temp/pulse-installer-shell-oiy9MO/shell-report.json`.
- Previsualización sin motor: `C:/Users/fysg5/AppData/Local/Temp/pulse-installer-shell-ByL3Hh/Pulse-Hub-Installer-Preview.exe`.
- Inspección PE del nuevo EXE: sin firma embebida. No es candidato público hasta
  firma, configuración autorizada y aceptación en Windows desechable.
- El empaquetado de aplicación QNhwlQ antecede los últimos ajustes menores del
  componente compartido (fallback WebGL). El shell y su orbe sí incorporan los
  últimos ajustes. Para release se debe reconstruir toda la cadena desde fuentes.
