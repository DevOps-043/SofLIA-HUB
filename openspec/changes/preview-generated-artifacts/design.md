# Diseño del visor

Estado: implementado y verificado localmente.

Main resuelve referencias cerradas de equipo (trabajo/archivo UUID) o IDs opacos
entregados por el selector nativo. La selección local requiere sesión host;
los entregables conservan también autorización de propietario y organización.
Hash, identidad del archivo, tamaño y generación se comprueban antes y después
de esperas. Cambiar chat o contexto desmonta el visor; se descartan resultados tardíos.

El contrato es una unión discriminada de texto, documento, tabla, diapositivas o
binario. Cuatro operaciones pasan por servicio, handler validado, allowlist,
preload y wrapper tipado. Solo el frame principal del Hub puede invocarlas.
No se transmiten rutas absolutas ni se permiten lectores arbitrarios desde IPC.

Se reutilizan MarkdownRenderer, Mammoth, ExcelJS, Sharp y el lector PPTX. Las
fórmulas muestran resultados guardados sin evaluarse. Office valida el índice
ZIP completo, recuento, tamaño, método y expansión real antes de sus lectores;
ZIP64 y multidisco quedan fuera del soporte. Word usa el servidor local en modo de lectura, con sandbox y scripts denegados.

HTML interactivo necesita una CSP independiente: srcdoc heredaba script-src self
del chat e impedía ejecutar botones. Un servidor efímero ligado a 127.0.0.1 sirve
solo GET de rutas UUID acotadas; valida Host y generación, sin CORS, caché,
redirecciones ni endpoints de archivos. CSP por encabezado impone sandbox
allow-scripts, deniega conexiones, subframes, workers, formularios y objetos.
El iframe no concede same-origin, popups ni navegación superior. Un preámbulo
no modificable desactiva ambos constructores WebRTC antes del archivo, porque
CSP no controla STUN. Main impide navegar desde el origen del visor. Se reutiliza
el permiso loopback de presentaciones sin relajar script-src del chat.

PDF.js 6.4.299 (Apache-2.0) se carga bajo demanda con worker local incluido en
la compilación. Solo se dibujan canvas y texto; no se ejecutan acciones del PDF.
Error o falta de respuesta durante 20 segundos rechazan la carga. Cerrar termina el
worker inmediatamente aunque destroy() no conteste; los rechazos tardíos tienen
observador. Las imágenes se decodifican y acotan en main; sus blobs se revocan.

El panel ofrece navegación entre entregables, código cuando aplica, ampliación,
Guardar copia y Abrir fuera. En navegador integrado ocupa el área del chat
flotante, respetando los límites de la vista nativa. Word/PPTX declaran la vista
de lectura/contenido y conservan el original para su aplicación de autoría.

Guardar copia usa creación exclusiva, sin sobrescritura. Abrir fuera requiere
un clic y crea una instantánea privada de los bytes verificados; así evita
abrir una ruta sustituida tras comprobarla. Las copias son temporales y acotadas;
se limpian al cerrar/cambiar sesión, con limitación si Office las mantiene
bloqueadas o el proceso cae. HTML permanece en el sandbox.
