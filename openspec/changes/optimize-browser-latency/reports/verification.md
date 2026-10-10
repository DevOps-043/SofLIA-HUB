# Verificación de latencia del navegador

Estado: implementación integrada. Medición inicial 2026-10-07; seguimiento de
verificación 2026-10-08. Compuerta general aprobada; evidencia inicial y
seguimiento registrados abajo.

## Medición reproducible

La [sonda nativa](../../../../test/manual/browser-native/latency.cjs) carga el
servicio real compilado. Usa perfiles temporales, servidor en loopback, doce
iframes y un recurso que tarda 750 ms. No carga bootstrap, .env, cuentas, Google
ni proveedores externos. Se ejecutaron tres pares alternados con Electron 44.5.1
sobre build previo y build optimizado. [Datos](native-latency.json).

| Medida | Antes, rango | Después, rango |
| --- | --- | --- |
| Acuse de apertura | 887–1039 ms | 16–20 ms |
| Acuse de navegación | 815–871 ms | 6–11 ms |
| Acuse de nueva pestaña | 858–895 ms | 9–22 ms |
| Publicaciones por 100 viewports idénticos | 100 | 0 |
| Lecturas de selección por cinco teclas ordinarias | 49 | 0 |

Los acuses indican aceptación tras validación e inicio, no descarga completa.
La sonda espera que cada página termine antes de comenzar la siguiente medida.
El recurso conserva sus 750 ms: no se atribuye esa espera a una mejora de red.
El presupuesto remoto de navegación segura tampoco se modifica ni se cachea.

Para repetir, ejecutar el archivo con el Electron instalado y pasar como
argumentos la raíz absoluta del build y una ruta absoluta de salida JSON.
El runner debe filtrar el entorno como los smokes nativos existentes, sin
ELECTRON_RUN_AS_NODE ni variables de proveedores. Los perfiles de prueba se
conservan en el directorio temporal; no se toca el perfil de navegación real.

## Cambios y seguridad

- La UI solicita `waitForLoad:false`; el cliente previo y el agente del renderer
  conservan true por defecto. Preload transporta únicamente esa opción conocida,
  el handler valida booleano y el servicio mantiene sus controles antes de cargar.
- Una carga reemplazada por otra orden, enlace, navegación interna de la página,
  perfil o cierre no publica resultados sobre el nuevo contexto.
- Resize se agrupa por cuadro. Viewport idéntico evita layout/publicación; vista
  rematerializada, restauración y petición explícita del agente conservan acuse.
- Selección real, mouseUp, Ctrl/Meta+A y Shift con navegación siguen funcionando.
  KeyUp ordinario y cursor colapsado no disparan lecturas globales. La lectura no
  sintetiza gesto y exige que documento, vista, pestaña, perfil y control sigan vigentes.
- Se conserva el arreglo de Huddle, aislamiento, certificados, permisos por origen,
  presupuesto de ocho vistas y todos los canales allowlisted existentes.
- Las sugerencias conservan debounce de 140 ms, se ligan al texto consultado y
  dejan de ser elegibles inmediatamente al editar. Cleanup ignora respuestas
  tras Escape o desmontaje; `profileRevision` remonta la barra sin historial anterior.
- Recarga o pérdida del renderer oculta las vistas del workspace y retira su
  geometría. La tarea supervisada recibe stop y conserva reserva hasta cleanup;
  guardas anteriores no reviven con otro viewport. Avisos pendientes se deniegan.
  Páginas y ventanas separadas se conservan.

## Evidencia de la fase inicial

- `npx vitest run --project main electron/__tests__/integrated-browser-service.test.ts electron/__tests__/integrated-browser-handlers.test.ts electron/__tests__/preload.test.ts`:
  308 casos aprobados. La guardia se comprueba con `assertCurrent()` y tipo
  `CuContextChangedError`, antes y después de recarga y nuevo viewport.
- `npx vitest run --project renderer src/__tests__/components/IntegratedBrowserPanel.test.tsx src/__tests__/components/BrowserWorkspaceLayout.test.tsx src/__tests__/services/integrated-browser-service.test.ts src/__tests__/services/integrated-browser-tools.test.ts`:
  98 casos aprobados: barra, overlays, layout, wrapper y contratos de agentes.
- `npm run typecheck` y `npm run build:app`: aprobados. Avisos previos de tamaño
  de bundles e imports dinámicos no son errores de compilación.
- `npm run lint:changed`, `npm run docs:check` y validación OpenSpec estricta:
  aprobados, sin ampliar deuda de lint. Arnés, adaptadores y supply chain
  aprobados durante `npm run verify:pr`.
- Revisión independiente: once regresiones focalizadas aprobadas. Corrigió la
  espera del agente renderer, callbacks sustituidos por navegación web y lectura
  que terminaba después de tomar control el agente. Sin hallazgos bloqueantes restantes.
- Revisión del bug: corrigió invalidación de guardas y avisos pendientes al perder
  renderer. Las regresiones de recarga/crash fallaron antes de implementar el fix.
- Electron real reprodujo «La página quedó superpuesta al chat tras recargar»
  contra build anterior. La misma sonda pasó con el nuevo build:
  [evidencia nativa](native-reload.json), ocultación real de las vistas y
  reapertura únicamente tras nueva geometría. Acuses de esa corrida: 62/15/23 ms;
  publicaciones y sondeos redundantes siguen en cero.
- Verificación visual 2026-10-07: Google mostró página y barras juntas; cerrar
  navegador retiró la página y dejó el chat libre. Gmail/Chat cargó, y el intento
  de Huddle dejó tarjeta «Llamada perdida». Esta fase no acredita recepción,
  audio ni una mejora del tiempo de negociación de llamadas.
- Primera ejecución de `verify:pr`: adaptadores, arnés y cadena de suministro aprobaron; se detuvo en
  inventario documental de pruebas desactualizado (511 archivos). Es la misma
  deuda previa del checkout principal, no se ocultó ni amplió para pasar.

## Seguimiento de optimización y compuerta

- Inventario sincronizado: 511 archivos, 356 main, 154 renderer y uno de scripts.
  `npm run docs:inventory:sync` deriva las cifras desde Git; el check ordinario
  sigue rechazando diferencias sin escribir. Prueba negativa en el worktree
  aislado: cifras incorrectas rechazadas sin alterar el documento; sincronización
  restaura exactamente el original y una segunda ejecución es idempotente.
  Declaraciones duplicadas o ausentes también se rechazan sin escritura.
- Cierre múltiple: un layout final en lugar de uno por pestaña; cerrar doce
  pestañas a la derecha publica un estado final, frente a doce publicaciones
  anteriores. La restauración de la pestaña conservada mantiene sus eventos de
  carga. Historial y orden conservados, sin materializar destinos descartados.
- Las regresiones de selección inválida tras fallo de limpieza y de fullscreen
  fallaron antes del arreglo y pasan después. Los fallos de creación del
  reemplazo o de su vista se inyectan con mocks: se retira la página anterior,
  se publica selección válida y se conserva el error. No se afirma haber
  reproducido esos fallos nativos excepcionales en Electron real.
- Prueba de permisos de cámara/micrófono: espera el callback real con I/O del
  almacén, en lugar de sondear con el límite implícito de un segundo de `waitFor`.
  Conserva el timeout general de 15 segundos y todas las aserciones de permisos.
- Ocho regresiones focalizadas aprobadas; revisión independiente: siete casos
  de cierre/fullscreen/error aprobados y caso de permisos aprobado por separado,
  sin bloqueadores pendientes. El seguimiento conserva el arreglo de Huddle.
- `npm run verify:pr`, estado final del seguimiento: código de salida 0;
  345 archivos aprobados y uno omitido; 3692 casos aprobados y uno omitido
  (3693 total), duración 96,21 s. Pasaron adaptadores, arnés, cadena de suministro,
  documentación, semilla de skills, OpenSpec, typecheck, lint incremental y
  suite general. La excepción inicial de inventario queda resuelta.
- `npm run build:app` posterior a las correcciones finales: aprobado, salida 0.
  Revalidación documental y OpenSpec tras registrar evidencia: aprobada.

## Límites y reversión

La medición representa tiempo propio de SofLIA con red local controlada. No
acredita reducción del tiempo del servidor, negociación de audio o Internet.
No se registra contenido web ni se conserva caché de reputación.

Revertir únicamente el diff de optimize-browser-latency conserva Huddle y datos.
Los clientes que omiten la opción siguen esperando carga completa, por lo que
el rollout no obliga a cambiar agentes ni integraciones anteriores.
