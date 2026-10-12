# Visor local de entregables

Estado: implementado y verificado localmente. Solicitud del 11 de octubre de 2026.

Los archivos del equipo solo se abrían con `shell.openPath`: sin una aplicación
predeterminada no había contenido visible en PulseHub. Se añade un visor junto
al chat con tarjetas, navegación entre entregables, descarga y apertura externa
explícita. La opción «Abrir archivo» permite elegir documentos locales mediante
el selector del sistema, sin aceptar rutas desde el renderer.

Se soportan Markdown, texto/JSON, Word, Excel/CSV, PowerPoint (lectura de
contenido), PDF, imágenes y aplicaciones HTML autocontenidas. Se reutilizan
Mammoth, ExcelJS, Sharp, el lector PPTX y Markdown existentes. PDF.js (Apache-2.0) es la única dependencia nueva: el visor nativo quedaba
en blanco bajo la CSP vigente. No se añade un
segundo motor de generación ni una dependencia de Office en la nube.

Las aplicaciones HTML se ejecutan en un iframe de origen opaco, sin red, IPC,
formularios, ventanas emergentes ni acceso al disco. No se ejecutan binarios
arbitrarios. Los archivos originales se conservan; la edición de Office y el
renderizado exacto de PowerPoint/Word no forman parte de este incremento.

Referencia de producto consultada: [visor oficial de ChatGPT/Codex](https://learn.chatgpt.com/docs/artifacts-viewer?surface=app).
La documentación describe el comportamiento de su producto; la implementación
local se diseña con los servicios y permisos de PulseHub.
