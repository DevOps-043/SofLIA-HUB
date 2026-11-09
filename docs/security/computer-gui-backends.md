# Backend GUI heredado: procesos y OCR

Estado: vigente. Actualizado: 2026-10-26.

<!-- evidence: electron/computer-use/gui-action.ts -->
<!-- evidence: electron/computer-use/gui-tool.ts -->
<!-- evidence: electron/computer-use/gui/process.ts -->
<!-- evidence: electron/computer-use/gui/backends.ts -->
<!-- evidence: electron/computer-use/ocr-targeting.ts -->

## Alcance

La primitiva heredada use_computer del dispatcher mantiene movimiento, clicks,
drag, escritura y key. No reemplaza los drivers ni la política de Desktop Agent.
El handler computer:use-computer conserva fuente/sesión y aprobación nativa,
pero su canal sigue fuera de la allowlist del preload: esta unidad no abre una
API renderer nueva. Las rutas runtime conservan sus guardas de entrada propias.

## Código y datos

Los hijos se lanzan con spawn, shell false y windowsHide true, sin concatenar
texto del usuario en shell. Windows ejecuta PowerShell fijo codificado y recibe
JSON Base64 por stdin; texto largo no infla la línea de comando. Escritura escapa
metacaracteres SendKeys; key traduce un acorde cerrado a códigos virtuales.
Saltos de línea/tab se envían como teclas correspondientes, con comportamiento
dependiente del campo/aplicación destino.

macOS mantiene Quartz/Python para mouse y System Events/osascript para teclado.
Los programas son fijos y sus datos viajan en stdin/argv. Linux X11 usa xdotool:
texto por stdin, teclas de allowlist y coordenadas numéricas separadas; Wayland,
headless y plataformas ajenas se rechazan. No existe fallback de shell.

Se corrige middle_click de Windows y el gesto drag desde cursor actual hasta
destino. Los scripts Windows/macOS intentan soltar botones en finally. Una
cancelación física puede interrumpir ese finally y dejar entrada parcial.

## Vigencia y recursos

Una sola operación de este adaptador GUI a la vez, sin cola. Captura una revisión
de identidad main y, si viene por el handler, su contexto de ventana/documento.
Revalida después de capturas/OCR, antes de entrada y antes de captura final.
Cambio/A/B/A, navegación, destrucción o plazo revocan etapas posteriores; no hay
captura de depuración automática al fallar. Progresos requieren lease vigente.

Cada proceso admite 15 s y 64 KiB de salida combinada. Se solicita terminar al
vencer, revocar o exceder cuota; la operación espera close físico. La lease tiene
plazo de 60 s: no es garantía de respuesta en ese tiempo si un proveedor no
cierra. No se libera exclusión por mero timeout lógico. No se reflejan errores,
scripts, texto de teclado ni salida cruda en logs/respuestas.

## OCR Tesseract 7

Se pide blocks explícitamente y se recorren párrafos/líneas/palabras válidos.
Imagen máxima 32 MiB, consulta 20000 caracteres, 50000 nodos de salida y dos
millones de caracteres acumulados; no se aceptan confianza/bbox no finitos.
Palabras requieren confianza mayor a 50; líneas mayor a 40. Objetivos en puntos
distintos producen GUI_AMBIGUOUS_TARGET; sin objetivo, GUI_TARGET_NOT_FOUND.
No se pulsa silenciosamente el primero.

El worker retornado se termina en finally. Tesseract resuelve terminate antes
de exit: con el Worker nativo expuesto por la versión instalada se espera también
ese exit. Si revoca durante creación tardía, el worker devuelto se termina sin
reconocer; si falla después de revocar, no se crea idioma alternativo.

Tesseract mantiene la obtención de modelos que ya ofrecía, incluido fallback
spa/eng bajo revisión vigente. No acredita disponibilidad offline ni limpieza de
un worker interno que el proveedor no llegó a devolver al fallar la creación.
Esa ruta de inicialización sigue dependiendo del contrato del proveedor.

## Evidencia y límites

Pruebas sustituyen procesos/capturas/OCR y comprueban el cierre de un thread Node
inocuo real, sin modelos ni GUI. PowerShell se valida con parser AST y Python
con ast.parse; no ejecutan los programas. Sintaxis/permisos/entrada física en
los tres SO siguen pendientes de verificación nativa. No se usó preview ni GUI
para sortear restricciones del entorno.

Revocar o cerrar un hijo no revierte eventos enviados. La exclusión sólo cubre
este adaptador, no todos los controladores del equipo. No aporta atomicidad,
idempotencia ni arbitraje global frente a Desktop Agent u otros procesos.
Fallos indican mayHaveApplied conservador; no se reintentan automáticamente.
[Evidencia del cambio](../../openspec/changes/secure-computer-gui-backends/reports/verification.md).

Referencias de API: [SendKeys](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.sendkeys?view=windowsdesktop-10.0),
[stdin de xdotool](https://github.com/jordansissel/xdotool/blob/main/cmd_type.c) y
[handlers AppleScript](https://developer.apple.com/library/archive/documentation/AppleScript/Conceptual/AppleScriptLangGuide/reference/ASLR_handlers.html).
