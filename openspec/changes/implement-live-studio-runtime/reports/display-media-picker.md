# Selector propio de compartir pantalla

Estado: verificado localmente. Fecha: 2026-10-13.

## Alcance y causa

El selector anterior usaba `dialog.showMessageBox` con 24 nombres como botones
y capturas de tamaño cero. No ofrecía miniaturas ni categorías.
Se sustituye por una ventana React modal sin marco que reutiliza entrypoint,
preload y tokens existentes, sin dependencias nuevas. Main conserva inventario
y objetos de captura. El selector recibe únicamente miniaturas y metadatos.
No se modifica el transporte audiovisual, las credenciales Zoom ni servicios remotos.
Se conserva el trabajo preexistente en `codex/live-studio-runtime`.

## Validación ejecutada

- `npx vitest run electron/__tests__/display-media-picker.test.ts src/__tests__/components/DisplayMediaPicker.test.tsx src/__tests__/services/studio-media.test.ts`: 36 pruebas correctas en tres archivos.
- `npm run typecheck`: correcto.
- `npm run lint:changed`: 67 archivos sin deuda nueva respecto a HEAD.
- `npm run harness:validate`, `npm run docs:check`, `npm run docs:system:check`: correctos.
- `npm run openspec:validate`: 63 cambios correctos, ninguno rechazado.
- `npm run verify:pr`: compuerta completa correcta; 419 suites correctas y una omitida, 4323 pruebas correctas y una omitida.
- `node scripts/quality/smoke-display-media-picker.mjs`: Electron real, sin bootstrap del Hub ni lectura de `.env`; miniaturas nativas, puente exclusivo de tres métodos, ausencia de `window.ipcRenderer`, captura real de pantalla, ventana y pestaña mediante WebFrameMain, cancelación sin flujo.
- QA visual: captura clara de 1040 × 760 y oscura de 760 × 560, sin desbordamiento horizontal; miniaturas legibles, selección visible, área de fuentes con scroll y acciones fijas. Capturas temporales fuera de Git.
- `git diff --check`: correcto.

El primer gate detectó cifras documentales desactualizadas al agregar canales y
pruebas. Se actualizaron los canales derivados y se sincronizó el inventario
con el script canónico, sin cambiar validadores ni ampliar baselines.
El smoke detectó una ruta incompatible con bundling CommonJS; se resolvió desde
`app.getAppPath()`. Chromium cancela con `AbortError` o `NotAllowedError`; ambos
se comprobaron como rechazo sin stream, sin afirmar un nombre único de excepción.

## Revisión adversarial local

Se intentó seleccionar IDs inventados, payloads malformados, subframes y otros
renderers: todos rechazados sin revelar inventario. Se probó ventana desaparecida,
recarga de pestaña a la misma URL, cambio de perfil y cambio del solicitante:
no entregan la fuente anterior. Enumeración pendiente, cierre durante carga,
Escape, cancelación explícita, navegación del padre, crash y timeout liberan
la solicitud. Una segunda solicitud del mismo padre se cancela. Se excluye la
ventana del propio selector del inventario. Las imágenes nunca se interpolan en HTML.

## Límites y reversión

Pestañas: solo vistas materializadas del navegador del Hub, sin sensibles ni
control de agente. No se enumeran pestañas individuales de Chrome/Edge externos.
Vistas previas actualizadas a demanda; no son una transmisión en vivo. Audio del
sistema disponible solo cuando fue solicitado en Windows, desactivado inicialmente
y con aviso de que incluye todas las aplicaciones. No se ha ensayado una llamada
Zoom remota autenticada en este cambio; el smoke comprueba la frontera local real.
No se archiva el cambio mayor del estudio, cuyas validaciones remotas siguen pendientes.

Reversión local: retirar únicamente los archivos/ediciones del selector, restaurar
su implementación anterior y retirar sus tres canales. Conservar las modificaciones
previas del estudio y sus especificaciones. No hay datos, migraciones ni despliegue
que revertir. Reiniciar la app permite cargar el nuevo main/preload en instalaciones
que estén ejecutando una compilación anterior.
