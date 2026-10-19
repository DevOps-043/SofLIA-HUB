# Verificación del menú de conversaciones

Estado: corrección verificada; compuerta general con excepción. Fecha: 2026-10-14.

## Diagnóstico y cambio

`ChatContextMenu` se montaba con posición absoluta dentro de `ChatActions`, a su
vez contenido en el `nav` desplazable y en ancestros con `overflow-hidden` y
`backdrop-filter`. El z-index no evita ese recorte. El menú ahora usa un portal a
`document.body`, posición fija medida desde el botón y límites del viewport;
prefiere abrir encima cuando no cabe debajo. Mantiene los estilos y permisos.

Se retira el overlay interior que también quedaba sujeto a esos ancestros. El
cierre exterior comprueba botón y menú; Escape devuelve el foco sin scroll, las
flechas y Home/End recorren opciones y los eventos no seleccionan el chat padre.
Scroll, resize y ResizeObserver de la barra lateral actualizan el anclaje.

Implementación aislada desde `f0b18bc` en `.worktrees/fix-chat-menu-overflow`, rama
`codex/fix-chat-menu-overflow`, con dependencias locales enlazadas por junction.
Sin instalación de paquetes, cambios de IPC ni acceso a secretos.

## Evidencia

- Antes del arreglo: `npm run test:renderer -- src/__tests__/components/Sidebar.test.tsx --maxWorkers=2`:
  siete pruebas existentes aprobadas y seis nuevas fallidas por ausencia del
  menú accesible esperado.
- Después: `npm run test:renderer -- src/__tests__/components/Sidebar.test.tsx src/__tests__/components/SidebarFolderActions.test.tsx --maxWorkers=2`:
  21 pruebas aprobadas, incluidos portal, apertura superior, bordes laterales,
  reposicionamiento, foco, teclado, cierre exterior y eliminación sin seleccionar
  el chat.
- Sonda nativa con Electron 44.5.1, React y CSS reales del repositorio, 24 chats
  y footer fijo en un contenedor con overflow y backdrop-filter. La versión
  anterior reprodujo el recorte: menú entre y=510,20 y y=656,80 para viewport de
  602 px; la opción Eliminar no recibió hit-testing. Después del arreglo:
  - Barra izquierda clara: menú entre y=329,17 y y=476,17.
  - Barra derecha oscura: menú entre y=329,17 y y=476,17.
  - Barra derecha clara en viewport de 322 px de altura: menú entre y=49,17 y y=196,17.
  En los tres casos se conservó el scroll, todas las opciones quedaron dentro
  del viewport, el clic nativo en Eliminar cerró el menú y ejecutó la acción sin
  seleccionar el chat. Se inspeccionaron las capturas de los tres escenarios.
  Artefactos aislados, scripts `smoke.mjs`/`native.cjs`, reportes `baseline.json` y
  `fixed.json` y capturas en `C:/Users/fysg5/AppData/Local/Temp/soflia-chat-menu-I6SXVh/`.
  La línea base se obtuvo con los archivos de `f0b18bc` antes de aplicar el parche
  al checkout principal; para repetirla se necesita ese ref en un checkout temporal.
  La preparación de la sonda requirió corregir rutas virtuales y argumentos del
  runner; sólo se considera evidencia la ejecución final aprobada. No equivale
  a probar el instalador ni la aplicación completa.
- `npm run verify:pr` con `VITEST_MAX_WORKERS=2`: código 1 en la suite general. Adaptadores, arnés,
  cadena de suministro, documentación de sistema, enlaces, semilla, OpenSpec,
  tipos y lint incremental aprobados. Suite: 429 archivos aprobados, uno fallido
  y dos omitidos; 4397 pruebas aprobadas, una fallida y cinco omitidas. Único fallo:
  timeout de 15 s en `background-teams.test.ts`, caso existente de generación
  Word/PowerPoint/Excel (29,08 s observados). Ese archivo no se modificó y el
  mismo timeout fue observado antes de este cambio en la verificación del cierre
  del navegador. No se ampliaron timeouts ni se declara la compuerta aprobada.
- Repetición del único fallo: `npm run test:main -- electron/__tests__/background-teams.test.ts -t 'crea Word, PowerPoint y Excel' --maxWorkers=1`:
  aprobado (4,38 s de ejecución del caso; 39 casos omitidos por el filtro).
- `npm run docs:check` después de completar el informe: 542 archivos Markdown
  activos con enlaces válidos.
- `git diff --check`: aprobado.

## Límites y reversión

La verificación se realiza en aislamiento respecto a los cambios de Studio y del
cierre del navegador presentes en el checkout principal. El parche de los cuatro
archivos modificados se trasladó al checkout principal con `git apply --check` y
`git apply`, sin conflictos ni cambios en el índice ajeno. Su contenido coincide
con el verificado en aislamiento (comparación SHA-256). No se empaqueta ni se
modifica la aplicación instalada. La reversión consiste en retirar únicamente
el cambio de presentación, sus pruebas y especificación.
