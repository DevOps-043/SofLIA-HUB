# Verificación del visor local

Fecha: 2026-10-11. Estado: implementado y comprobado localmente.

## Resultado

Los entregables comprobados abren el panel lateral desde el chat, con navegación
entre archivos, formato legible, código cuando corresponde, Guardar copia y
apertura externa explícita. Herramientas permite elegir archivos locales. El
navegador integrado reutiliza el área de chat flotante para evitar que su vista
nativa cubra el visor. No se cambia el visor de presentaciones del workspace.

Lectores disponibles: Markdown/texto/JSON, DOCX, XLSX/CSV, contenido PPTX, PDF,
imágenes y aplicaciones HTML autocontenidas. PDF.js 6.4.299 (Apache-2.0) es la
única dependencia añadida; los demás lectores ya existían. La implementación
conserva main/preload/renderer, referencias tipadas y una única fuente de límites.

## Comprobaciones

- `npm run verify:pr`: correcta;377 archivos de pruebas aprobados y1 omitido,
  3996 pruebas aprobadas y1 omitida. Incluye typecheck, lint, arnés, documentación,
  suministro, OpenSpec y suite completa.
- `npm run build:app`: correcto. Incluye `pdf.worker.min-*.mjs` como recurso
  local y carga PDF bajo demanda.
- Vista real del chat: siete entregables Markdown del piloto anterior abrieron
  un archivo formateado en el panel; se comprobó el vínculo host con el mensaje.
  [Captura del chat](native-markdown.png).
- Lectores reales en Electron con archivos de prueba locales: Excel mostró
  Presupuesto/Notas y el total guardado 350; Word se convirtió con Mammoth y se
  abrió en iframe sin scripts. [Excel](native-excel.png),[Word](native-word.png).
- PDF se dibujó en canvas con su texto. También se probó bajo `file:` con el
  worker de `dist/assets`, sin CDN:1 página y texto «Informe del equipo / PDF de
  prueba local». [PDF](native-pdf.png),[resultado nativo](native-runtime.json).
- HTML en Electron bajo la CSP padre: botón 0→1, acceso al padre bloqueado,
  ambos constructores RTC ausentes, cambio de contexto 403. Un intento de
  navegación a un servidor local de prueba dejó la página original y produjo
  cero peticiones. [HTML](native-html.png).

La prueba nativa aislada usa archivos propios y un guard de contexto simulado;
comprueba render, worker distribuido y navegación Electron. Las pruebas IPC
cubren validación del frame, referencias, autorización tardía, cancelación,
creación exclusiva y apertura externa. El selector nativo se simula en las
pruebas automatizadas; no se afirma haber automatizado el diálogo del sistema.
La comprobación posterior en la sesión real autenticada abrió el Word del
equipo y mostró su contenido. Véase el reporte refine-artifact-workspace y
native-word-viewer.png. No se alteraron credenciales.

## Revisión independiente

Sin hallazgos accionables abiertos tras corregir y revalidar:

1. Validación final de enlaces Markdown anidados, protocolos y credenciales.
2. Coherencia del directorio ZIP, entradas ocultas por recuento falso y expansión.
3. Delimitadores CSV dentro de campos citados y comillas escapadas.
4. CSP heredada que impedía los botones HTML: origen loopback separado.
5. Bypass STUN de CSP: constructores RTC cerrados antes del archivo; Chromium
   real confirmó cero paquetes UDP y cero peticiones fetch/imagen de los vectores probados.
6. Carrera de apertura externa: instantánea de los bytes comprobados.
7. Worker PDF sin respuesta y cierre tardío: terminación inmediata, plazo y
   errores controlados, sin rechazo no observado.

La revisión ejecutó 43 pruebas en ocho archivos del worktree y 7 pruebas PDF en
principal con hashes idénticos. La navegación pendiente de esa revisión se
comprobó después con Electron nativo, como registra `native-runtime.json`.

## Límites

Word y PPTX ofrecen lectura/contenido, con fidelidad declarada; Excel muestra
valores guardados y no recalcula. HTML requiere recursos autocontenidos; las
aplicaciones nativas se abren mediante Abrir fuera, no se emulan. Los límites y
truncamientos se muestran. Las copias temporales externas se limpian con mejor
esfuerzo; Office bloqueando el archivo o una caída pueden dejar un temporal.
No se construyó ni instaló un instalador ni se modificaron credenciales.

## Fuentes de diseño

- [Visor de artefactos oficial](https://learn.chatgpt.com/docs/artifacts-viewer?surface=app).
- [Contenido embebido en Electron](https://www.electronjs.org/docs/latest/tutorial/web-embeds).
- [Navegación de frames Electron](https://www.electronjs.org/docs/latest/api/web-contents/).
- [PDF.js oficial](https://mozilla.github.io/pdf.js/examples/).

Se adoptó el patrón visible de vista junto al chat; no se atribuye a Codex una
arquitectura interna que su documentación no publique.
