# Verificación de fluidez

Estado: implementación verificada en código. Fecha local: 2026-10-10.

## Resultado y diagnóstico

Confirmado en código: las sugerencias activaban captura, espera de pintura y
ocultación de la vista nativa. Por eso las animaciones visibles se convertían
en una imagen estática mientras se editaba una dirección. El desplegable ahora
reserva su altura, mantiene la vista visible y restaura la geometría al cerrar.
Los gestores y avisos conservan su comportamiento previo.

La activación reaplicaba zoom idéntico: se evita modificar el factor nativo si
coincide y se deduplica emulación por factor/tamaño/documento. Recarga y carga
invalidan la emulación. Las guardas ante carga y crash se conservan.

Las regresiones también detectaron una operación de gestor que podía terminar
después del desmontaje y ocultar la superficie siguiente. Se cancela ese efecto.

## Comandos y resultados

- `npx vitest run electron/__tests__/browser-tab-zoom.test.ts electron/__tests__/integrated-browser-service.test.ts src/__tests__/components/IntegratedBrowserPanel.test.tsx src/__tests__/components/BrowserWorkspaceLayout.test.tsx`:
  primera verificación, 309 casos aprobados.
- `npx vitest run electron/__tests__/browser-tab-zoom.test.ts src/__tests__/components/IntegratedBrowserPanel.test.tsx`:
  estado final, 69 casos aprobados; incluye resize, cambio de perfil, acuse tardío,
  desmontaje, alternancia y recarga con la misma URL.
- `npm run typecheck`: aprobado.
- `npm run app:smoke:build`: compilación aislada aprobada sin copiar `.env`.
- `npm run verify:pr`: aprobado en el estado final del código TypeScript;
  352 archivos aprobados, uno omitido; 3.758 casos aprobados, uno omitido.
  Incluye arnés, documentación, OpenSpec estricto, typecheck y lint incremental.
  Se corrigió una incidencia nueva de refs durante render antes de repetir.

## Sonda nativa y límites

La [sonda](../../../../test/manual/browser-native/fluidity.cjs) ejecuta el
servicio real compilado con contenido HTTP en loopback y perfil temporal.
El proceso recibe solamente variables del sistema; no carga bootstrap ni `.env`.
La ventana de prueba usa opacidad cero, no toma foco y no aparece en la barra.

[Resultados nativos](native-fluidity.json): 200 activaciones entre dos pestañas
cargadas en 16,90 ms dentro del servicio, cero reaplicaciones de factor o
emulación; la vista conserva visibilidad al reservar y restaurar espacio.
La recarga conserva el zoom de 150 %. El runtime instalado se identifica como
Electron `44.0.0-beta.3`, aunque el manifiesto declara `44.5.1`; esta medición
no acredita el runtime estable de un instalador nuevo.

La ventana invisible no produjo cuadros de requestAnimationFrame. Por tanto,
la sonda NO acredita continuidad visual de animación en una ventana visible.
Los intentos iniciales registraron esa limitación y una aserción de emulación
que no aplicaba al runtime con zoom nativo; la sonda final distingue ambos
caminos. La eliminación de captura/ocultación se comprueba en pruebas renderer.
No se midieron el sitio remoto de la captura ni tiempos de red, ni se empaquetó
o instaló una versión nueva. Estos acuses no representan latencia de pintura.

## Revisión y recuperación

Revisión local: cambios de perfil liberan el espacio anterior; acuses obsoletos
no reemplazan estado; desmontaje no revive ni oculta la superficie siguiente;
zoom nuevo, resize y recarga mantienen invalidación. Se conservan permisos,
aislamiento y presupuesto de ocho vistas vivas. Una pestaña suspendida necesita
recargar su documento. No se archivó la especificación ni se creó un PR.

La rama `codex/browser-fluidity` conserva el trabajo local anterior. Rollback:
revertir únicamente los cambios de esta tarea. El instalador en ejecución no
se reemplaza por modificar el código; necesita una compilación actualizada.
