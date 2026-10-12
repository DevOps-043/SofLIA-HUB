# Verificación — 11 de octubre de 2026

El chat muestra una síntesis del trabajo y los archivos; el panel lateral
agrupa entregables sin tarjetas de agentes, herramientas ni contadores de
tokens. Se conservan estados globales y controles de recuperación. Los
archivos mantienen su apertura mediante el visor existente y sus guardas.

El visor reúne las acciones en la cabecera, elimina pies informativos
permanentes y usa iconos pequeños de trazo uniforme según la extensión.
Cabecera medida: 43 px; fila de pestañas: 35 px; icono principal: 19 px.
Las pestañas seleccionadas se desplazan a la zona visible al seleccionarlas
y cuando cambia el ancho, mediante un observador que se retira al desmontar.

`PanelResizeGrip` se extrajo del sidebar original. Sidebar, visor y panel de
archivos usan el mismo componente: barra de 4 px, alturas de 32/64/96 px,
colores de reposo/hover y brillo de arrastre originales. El hook compartido
acota el ancho, permite teclado, recuerda la preferencia y cancela el
arrastre cuando se retira el panel, sin remontar la vista del documento.

## Validación

- Gate inicial: aprobado; 53 items OpenSpec válidos, typecheck y lint
  incremental aprobados; 378 archivos de pruebas aprobados, uno omitido;
  4.027 pruebas aprobadas y una omitida. La última repetición, con más
  cambios simultáneos presentes en el checkout, aprobó todas las etapas
  previas y registró 4.034 pruebas aprobadas, dos fallidas y una omitida.
  Los dos fallos pertenecen al navegador integrado: timeout de la prueba
  de cuota/commit de atajos y error de bitácora cifrada al comprobar un
  documento sensible. Ambos pasaron al repetirse aisladamente (dos pruebas
  aprobadas). Se conserva esta limitación: la última suite global no está
  completamente verde. No se modificaron esos módulos ni sus pruebas.
- `npm run build:app`: aprobado. Persisten avisos de tamaño de chunks e
  imports dinámicos de la aplicación; no son errores de compilación.
- Última pasada focalizada del visor, panel lateral, resultados y controles:
  27 pruebas aprobadas en cuatro archivos. Incluye mantener visible la
  pestaña seleccionada al redimensionar, sin repetir la lectura del archivo.
- Pruebas de política y enrutamiento: se verificaron solicitudes implícitas,
  citas, preguntas descriptivas, negaciones y tareas que requieren contexto
  del navegador, documento o escritorio. La conversión simple conserva su
  ruta directa; los encargos independientes pueden iniciar un equipo.
- QA en la ventana Electron autenticada: Word real visible, sin pies
  permanentes, sin desbordamiento horizontal; arrastre de 587 a 537 px,
  indicador de 96 px y brillo durante el arrastre; tras soltar, estado de
  arrastre desactivado e indicador de 32 px. El documento permanece abierto.
  Capturas y mediciones: `native-compact-viewer.png`,
  `native-compact-drag.png` y `native-compact.json`.
- Panel real de archivos: `native-files.png`. Vista Word anterior y
  mediciones: `native-word-viewer.png` y `native-viewer.json`.
- Revisión independiente: se corrigieron los hallazgos sobre pérdida de
  contexto, arrastre al cerrar y delegación de peticiones negativas o
  descriptivas. La última pasada independiente aprobó 216 pruebas en 14
  archivos. Los ajustes posteriores de compacidad y el componente visual
  compartido se comprobaron con el gate completo y QA propio; el revisor
  agotó su cuota antes de una nueva pasada final.

El hover de 64 px comparte literalmente las clases del sidebar original;
no se registra como una medición de hover nativo: la captura automatizada
durante la evaluación del inspector no reflejó ese estado intermedio.

No se generó instalador ni se publicó una versión. Esta verificación no
constituye un nuevo piloto completo de generación multiagente; ese piloto
sigue pendiente en el cambio original de equipos ejecutores.

Se retiraron del repositorio el inspector temporal, sus expresiones, la
página y los runners de QA. El inspector se cerró y la aplicación permanece
abierta. La revisión automática rechazó el borrado de los perfiles de QA
en `%TEMP%` con «blocked by policy»: permanecen las carpetas
`pulse-viewer-native-*`, `pulse-viewer-smoke-0IkHHU` y
`pulse-viewer-pdfjs-runtime`, sin procesos de QA activos.
