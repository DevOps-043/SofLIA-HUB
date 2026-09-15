# Instalador Windows y Python privado

Fecha local: 2026-09-13, America/Mexico_City. Cambio `complete-integrated-browser-platform`.
Trabajo en `.worktrees/upgrade-integrated-browser`, rama `codex/finish-browser-recovery`.
Sin despliegue, migraciones, publicación, firma ni instalación de Pulse Hub.

## Implementación

- Preparación Python recuperable con staging y lock exclusivo; conserva runtime anterior, valida antes de promocionar y revalida caché.
- SHA256 oficial fijado por plataforma, HTTPS, límite de descarga y rechazo antes de extraer/ejecutar si la huella no coincide.
- Python/pip aislados y comprobación de versión, dependencias de voz/reuniones/documentos y ambos sidecars dentro del paquete.
- Bienvenida NSIS propia, arte Pulse Hub a 3x, texto nativo, español, progreso real y apertura final desmarcada. Conserva instalación asistida, ubicación, elevación y datos al desinstalar.
- Smoke Windows sin .env, claves, firma, publicación ni arranque del producto; copia física de dependencias, `npm ls`, comprobación del ASAR, PE y SHA256.
- Corrección de bloqueo XLSX: carga nativa inicial de NumPy en el hilo principal de Windows, antes de aceptar comandos.

## Referencias observadas

Se observaron las capturas de bienvenida/progreso de [Comet en Tom's Guide](https://www.tomsguide.com/ai/perplexity/how-to-use-perplexity-comet) y [Chrome en BleepingComputer](https://www.bleepingcomputer.com/tutorials/how-to-install-and-uninstall-google-chrome-in-windows/).
Son referencias visuales históricas, no una certificación de su UI actual. Se
adoptaron jerarquía corta, marca protagonista y progreso claro sin copiar sus
imágenes. El flujo se contrastó con las guías oficiales de
[Comet](https://www.perplexity.ai/help-center/en/articles/11172798-getting-started-with-comet) y
[Chrome](https://support.google.com/chrome/answer/95346?hl=es).
Los pins Python se obtuvieron de los digests de assets de la
[release oficial Astral 20250612](https://github.com/astral-sh/python-build-standalone/releases/tag/20250612).

## Verificación ejecutada

- `npm run python:setup`: descarga, instalación e imports completos aprobados. Segunda ejecución aprobada sin descarga; lock schema 2 y Python 3.12.11.
- `node scripts/quality/smoke-python-sidecars.mjs`: ambos procesos reales responden ready, ping, rechazo de comando desconocido y shutdown con exit 0. Sin micrófono ni modelos. Tras el arreglo: ready 107/194 ms y ping 1/4 ms en una ejecución; no es benchmark ni SLO.
- Pytest en venv de QA separado con `--system-site-packages`: `python/sidecar/tests python/tools_sidecar/tests -q`, **35 aprobadas en 2.48 s**. Pytest no se instaló en el runtime distribuible.
- Focalizadas de build/NSIS/Python/hook: **112 aprobadas en 5 archivos**.
- `npm run verify:pr`: aprobado, **3427 pruebas / 317 archivos**, inicio local 21:09:19, duración Vitest 149.16 s, `VITEST_MAX_WORKERS=4`. Incluye typecheck, lint incremental (23 TS), arnés, cadena de suministro, OpenSpec y documentación.
- ESLint explícito de preparador, helpers, generador y smokes: aprobado. La configuración CommonJS queda limitada a las tres entradas Node correspondientes; no se desactiva lint del código de producto.
- `npm run runtime:stable`: Electron 43.4.0 aprobado.
- Recursos BMP: cabecera, dimensiones, 24-bit y tamaño completo comprobados.
- Vista nativa de bienvenida compilada con NSIS 3.0.4.1: texto visible sin recortes, arte renderizado y controles Continuar/Cancelar presentes en la accesibilidad. La cancelación mostró su aviso y la ventana se cerró. No se ejecutó la sección de instalación del producto. El título de la primera vista de prueba tenía codificación incorrecta; se corrigió su etiqueta y se recompiló. No acredita toda la UI ni matriz DPI/lector de pantalla.

## Incidencias descubiertas y revisión adversarial

1. El primer smoke con junction (`pulse-installer-build-Ypvo7J`) generó un EXE,
   pero su ASAR carecía de `graceful-fs`/`lodash.defaults`. El resultado inicial
   queda **rechazado**: no distribuir ese archivo. Se corrigió con copia física,
   comprobación npm y validación de dependencias empaquetadas.
2. `pulse-installer-build-1er4tf` aprobó el empaquetado y las 42 comprobaciones de
   dependencias, pero precede al arreglo XLSX. Se genera otro artefacto con ese
   arreglo; tampoco usar el anterior como versión final.
3. Pytest reprodujo un XLSX sin respuesta: 34/35 al principio. Un stack de
   diagnóstico local mostró el worker detenido en carga nativa de NumPy.
   Inicializarlo antes de `ready` resolvió la regresión sin ampliar el timeout.
   La prueba informa ausencia de respuesta y retira su proceso en esa ruta.
4. Se probaron fuente insegura, hash malformado, plataforma no soportada, lock
   divergente, fallo de pip/import, salida parcial, recurso vacío/ausente y
   promoción fallida. La preparación anterior no borra datos para reintentar.

## Artefacto final de este corte

`npm run installer:smoke:win`: **aprobado** en
`C:/Users/fysg5/AppData/Local/Temp/pulse-installer-build-g6cooL`.
Incluye el arreglo XLSX y 2812 fuentes; 42 comprobaciones de dependencias
empaquetadas. Reporte `installer-report.json`, etapa `completo`, exitCode 0.

- Archivo: `release/0.9.8/Pulse-Hub-Windows-0.9.8-Setup.exe`.
- Tamaño: **360450941 bytes**, aproximadamente 344 MiB.
- SHA256: `38827750ed35b33a82ac7d3d035a72659697c96f2c71d4a4c54ca3daa4ffe1de`.
- Sin firma Authenticode, .env, publicación, arranque ni instalación del producto.
- Ambos sidecars dentro de `win-unpacked/resources` también pasaron el smoke
  NDJSON: ready 163/339 ms, ping 1/16 ms, rechazo y shutdown exit 0.
- Hash del sidecar de herramientas empaquetado idéntico al código actual:
  `c7ea2d34ec203b8202a9a21e038e56a7aa8416a21e9566fa6df64f2ea47e8907`.

## Límites de entrega

No hay firma Authenticode, garantía SmartScreen, prueba de instalación real,
actualización/desinstalación completa ni arranque autenticado. El build de smoke
excluye .env por diseño: no es un release configurado para usuarios. Se conserva
Python 3.12.11 fijado; falta revisión de actualización/CVE y lock con hashes de
transitivas pip antes de distribución pública. Los modelos se descargan al usar
sus funciones; no se acredita disponibilidad offline de voz/IA completa.
La tarea 9.5 permanece abierta por la aceptación Windows del producto, Windows
Hello y sync/Auth/RLS con dos equipos reales. No se cierra por compilar el EXE.

## Recuperación

Las fuentes y pruebas están en Git sin commit nuevo. Runtime y temporales son
locales e ignorados. Para revertir el runtime, cerrar sidecars y recuperar el
`previous-runtime` que indique el preparador; nunca borrar a ciegas la carpeta
raíz del proyecto. Los smokes anteriores y el venv de QA se conservan como
evidencia; el primer build aislado contiene junction y no debe limpiarse de
forma recursiva atravesando ese enlace. No se cambió Python del sistema.
