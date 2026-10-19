# Verificación del cierre del navegador

Estado: corrección verificada; compuerta general con excepciones. Fecha: 2026-10-14.

## Diagnóstico confirmado

La captura del usuario identifica `mainRendererCleanup → detachWindow → onClosed`.
El callback consultaba `window.webContents` después de destruir la ventana.
Conservar la referencia al emisor original permite retirar sus listeners y
continuar la liberación de pestañas y temporizadores.

Implementación aislada en `.worktrees/fix-browser-shutdown`, rama
`codex/fix-browser-shutdown`, desde `f0b18bc`. El checkout original contiene
trabajo de Studio ajeno a esta corrección. Se reutilizan las dependencias locales
mediante una junction; no se instalaron paquetes ni se modificaron secretos.
El parche de código, pruebas y arquitectura se aplicó después al checkout
principal mediante `git apply --check` y `git apply`, sin conflictos. Los tres
archivos coinciden con los verificados en aislamiento (comparación SHA-256).

## Evidencia ejecutada

- Antes del arreglo: `npm run test:main -- electron/__tests__/integrated-browser-service.test.ts -t 'completa el cierre con la ventana destruida|ignora el cierre tardío'`.
  Resultado: dos fallos con `TypeError: Object has been destroyed`, con y sin
  pestaña abierta; el escenario de reemplazo pasó.
- Después del arreglo: `npm run test:main -- electron/__tests__/integrated-browser-service.test.ts`.
  Resultado: 242 pruebas aprobadas, sin fallos.
- `npm run typecheck`: aprobado.
- Prueba nativa aislada con Electron 44.5.1: una ventana oculta se destruye;
  dentro de `closed`, el getter de `webContents` reproduce el error y retirar
  ambos listeners de la referencia conservada no lanza. Resultado: aprobado.
  Script y reporte temporal conservados en
  `C:/Users/fysg5/AppData/Local/Temp/soflia-browser-shutdown-v1h8Jw/`.
  Esta sonda verifica las APIs nativas; la suite automatizada verifica el servicio.
- `npm run verify:pr`: código 1 en la suite general. Adaptadores, arnés, cadena
  de suministro, documentación de sistema, enlaces, semilla, OpenSpec, tipos y
  lint incremental aprobados. Suite: 426 archivos aprobados, 4 fallidos y 2
  omitidos; 4391 pruebas aprobadas, 4 fallidas y 5 omitidas.
  Fallos observados:
  - `artifact-viewer.test.ts`: timeout de 15 s al procesar varias hojas Excel.
  - `background-teams.test.ts`: timeout de 15 s al generar archivos Office.
  - `integrated-browser-service.test.ts`: timeout de 15 s en el caso existente
    de 500 pestañas. Ese mismo caso pasó en la ejecución focalizada de la suite.
  - `PresentationWorkspacePanel.test.tsx`: no encuentra `role="status"` en el
    caso de informe visual. Es una prueba renderer de archivos sin cambios en
    esta corrección; no consume el servicio main modificado.
  No se declara aprobada la compuerta general ni se ampliaron timeouts.
- Repetición dirigida de los cuatro casos fallidos con `npm run test -- --maxWorkers=2`
  y filtro `-t 'representa varias hojas|crea Word|virtualiza vistas inactivas|muestra el informe visual'`
  sobre esos cuatro archivos: el caso de 500 pestañas y la generación Office de
  equipos pasaron (9,26 s y 8,85 s). Persisten el timeout de `artifact-viewer`
  (23,12 s) y el estado visual ausente en presentaciones. Resultado JSON en el
  directorio temporal de la sonda, archivo `recheck.json`. No se modifica código
  ajeno al cierre ni se atribuyen esos fallos a esta corrección sin evidencia.
- `git diff --check`: aprobado.

## Revisión local y límites

Se revisaron el orden de los dos callbacks de cierre, la retirada de listeners
del emisor original, la liberación de una pestaña exactamente una vez y el cierre
tardío de una ventana reemplazada. No se cambiaron canales IPC ni permisos.

No se inició ni se modificó la aplicación instalada y no se generó instalador.
La corrección requiere una nueva compilación y distribución para llegar a ella.
Reversión: retirar únicamente el cambio de referencia al emisor, sus pruebas y
documentación asociada; no altera datos persistidos.
