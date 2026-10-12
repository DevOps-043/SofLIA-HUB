# Verificación del inicio local

Estado: implementación verificada en código. Fecha local: 2026-10-10.

## Resultado

Inicio, creación sin URL, reemplazo de última pestaña y reapertura cargan la
portada SofLIA dentro de Chromium. Logo y estilos están empaquetados; no hay
fuentes, scripts ni recursos de red. El formulario conserva Google como buscador
y la barra acepta direcciones mediante las validaciones existentes.

El esquema admite sólo `soflia-inicio://inicio/`. Hosts/rutas alterados, query,
fragmentos, credenciales, puertos, file, data y javascript se rechazan en
navegación y restauración. GET/HEAD sirven el documento; POST devuelve 405.
Se conserva sandbox/contextIsolation, sin Node ni preload. La portada no entra
en historial ni sync web; sí en la sesión local. Se omiten las inyecciones de
selección/menú/escritura al terminar de cargar esta página interna.

Paleta única en `src/styles/theme-light.css` y `theme-dark.css`, importada por
renderer y portada. Media queries siguen nativeTheme sin recarga y desactivan
las animaciones con movimiento reducido. Sólo transform y opacity animan logo
y halo; no hay bucles JavaScript ni dependencias nuevas.

## Comandos y resultados

- Pruebas dirigidas de portada, servicio y panel: 304 casos aprobados antes del
  aislamiento final de las dos fixtures nuevas; la suite completa posterior
  incluye esas fixtures corregidas.
- Validación/seguridad/restauración dirigidas: 303 aprobadas en el primer intento;
  el caso restante detectó que Vitest sustituía CSS raw por texto vacío.
  Se habilitó sólo el CSS de esta portada y sus tokens; después pasó.
- `npm run app:smoke:build`: aprobado con el código de producto final, en sandbox
  temporal sin copiar `.env`. Primer intento detectó Array.at fuera del target
  ES2020 de una prueba; se corrigió sin cambiar tsconfig ni el baseline.
- `npm run verify:pr`: repetición final aprobada. 356 archivos aprobados y uno
  omitido; 3.821 casos aprobados y uno omitido. Typecheck, arnés, documentación,
  OpenSpec estricto, supply chain y lint incremental aprobados; 77 archivos
  TypeScript revisados sin deuda nueva.
- `node scripts/quality/validate-system-docs.mjs --sync-inventory`: sincroniza el
  inventario derivado de pruebas y comprueba la paleta compartida.

El primer gate completo registró dos ENOENT en pruebas de purga de perfil y un
reporte de presentación recibido antes de su listener. Las dos suites aisladas
pasaron sus 256 casos. Las fixtures nuevas de inicio se cambiaron a perfiles
temporales propios y el segundo gate completo pasó sin otras sondas pesadas en
paralelo. No se alteró código de presentaciones ni se ocultaron pruebas.

## Chromium real y revisión visual

La [sonda nativa](../../../../test/manual/browser-native/home.cjs) usa el servicio
compilado, perfil temporal y entorno filtrado con variables del sistema. No
carga bootstrap, `.env`, cuentas ni perfiles del usuario. Su salida está en
[native-home.json](native-home.json).

Confirmó logo decodificado, búsqueda con espacios/acentos/& mediante formulario,
cero solicitudes HTTP(S), temas distintos sin recarga, CSP que bloquea scripts,
ausencia de Node/preload, movimiento reducido y ancho de 320 px sin overflow.
Las capturas claro/oscuro se renderizaron en un compositor Chromium offscreen
con el mismo documento/sesión y se revisaron visualmente. Capturar directamente
la vista nativa de una ventana oculta produjo UnknownVizError; no se interpretó
como una captura aprobada ni se modificó el producto para eludirlo.

El acuse de una pestaña con `waitForLoad:false` tomó 5,74 ms en esta sonda;
materializarla tomó 1,76 ms. La carga completa de esa vista en ventana oculta
tomó 2,46 s y la primera apertura 4,16 s: el acuse NO es una medición de pintura,
no hay comparación contra Google ni garantía de carga instantánea. No se midió
FPS o fluidez visible en una ventana de usuario. El runtime instalado se reporta
Electron 44.0.0-beta.3 / Chromium 152.0.7977.30, aunque el manifiesto declara
Electron 44.5.1; esto no acredita un instalador estable nuevo.

## Revisión y recuperación

Se revisaron registro único de esquemas antes de ready, handler por partición,
restauración de URL exacta, ausencia de archivos arbitrarios, protocolo restringido,
estado de dirección y permisos, estilo compartido, errores/sandbox y presupuesto
de vistas. Electron exige un único registro de esquemas privilegiados:
[documentación oficial](https://www.electronjs.org/docs/latest/api/protocol#protocolregisterschemesasprivilegedcustomschemes).
Presentación e inicio se agrupan en esa llamada, sin habilitar bypassCSP.

Se preservaron los cambios locales anteriores en `codex/browser-fluidity`.
No se archivó OpenSpec, creó PR, empaquetó instalador ni sustituyó la aplicación
en ejecución. La instalación requiere una compilación actualizada para mostrar
la portada. Rollback: revertir sólo el diff de esta tarea.
