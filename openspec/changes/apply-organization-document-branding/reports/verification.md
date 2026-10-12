# Verificación de identidad y diseño documental

Estado: implementación local; compuerta de PR correcta y compilación verificada.
Base de trabajo: `d8c1de5`, rama `codex/organization-document-branding`.

## Alcance comprobado

- Marca de SOFIA Learning por organización seleccionada o scope del equipo.
- Membresía activa antes de preparar y guardar; guardas de actor, sesión SOFIA,
  selección obsoleta, cierre de sesión y cuenta en transición.
- Descarga de Storage con host exacto, HTTPS, sin redirecciones/credenciales,
  cota por cabecera y streaming, y normalización bitmap sin SVG.
- Logo/paleta en Word/PDF y lectura de Word. Preferencias explícitas conservadas.
- Aviso de recurso ausente en herramientas y archivos de equipos, persistido
  en el contrato cifrado existente. Sin nuevos canales, dependencias ni migraciones.
- Tema de lectura manipulado no produce CSS/código del archivo.

## Evidencia ejecutada

Línea base inicial: 37 pruebas de documentos, marca y estado de autenticación.
Primera regresión integrada: 111 pruebas focalizadas correctas. Compuerta de PR
intermedia: 4187 correctas y una omitida. Suite focalizada posterior de ocho
módulos: 129 correctas; posteriormente se añadió el caso de cuenta en transición,
cubierto por la compuerta final. Compuerta final: 4193 pruebas correctas, una
omitida; 396 archivos de prueba correctos. Incluye typecheck, lint incremental,
Arnés, supply chain, documentación, semilla y OpenSpec. `npm run build:app`
finalizó correctamente. Se verifican además las dos guardas finales de
liberación de descarga y cota de imágenes con pruebas focalizadas.

Comprobación posterior de las guardas finales: 130 pruebas en ocho módulos,
seguida de 44 pruebas en los tres módulos de documento/marca, incluyendo un
Word con nueve referencias de imagen que solo permite decodificar ocho en
lectura. Se repitieron typecheck, lint incremental y enlaces documentales.

Se exportaron dos muestras de contenido de demostración con el generador real:
documento breve (1 página) e informe con portada y tabla de 32 filas (Word:
5 páginas; PDF Chromium: 6). Se inspeccionaron todas las páginas a 1400 px.
Se corrigieron separación del encabezado Word y anchos de metadatos, se volvió
a renderizar y se inspeccionaron las seis páginas finales Word. Las siete
páginas PDF se revisaron completas. No se observan texto cortado, solapamientos,
logo deformado, tablas rotas ni encabezados huérfanos.

La lectura HTML usa el lector Office del producto y se comprobó con Edge
headless: dos imágenes, logo de encabezado 39 × 26 px y portada 180 × 120 px,
título RGB(10,37,64), dos tablas y portada centrada. Los archivos generados,
capturas y logs están únicamente bajo `.git/organization-document-qa/` y
`.git/organization-document-*.log`, sin incorporarlos al producto.

El renderer empaquetado de la skill falló por ausencia de LibreOffice. Para QA
se usó Word instalado en modo invisible, apertura de solo lectura, exportación
PDF y Poppler del runtime de Codex. La generación del producto no necesita Word.

## Revisión adversarial

Se intentaron refutar aislamiento por actor/organización, recuperación ante
red fallida, prioridad de ajustes, cota de imágenes y rechazo de temas hostiles.
Las guardas impiden guardar tras logout, cambio de selección o pérdida de
membresía. Los equipos usan la guarda del trabajo, sin depender de cambiar de
chat. La revisión descubrió que una selección de otra cuenta podía estar en
transición mientras main conservaba el actor anterior: se rechaza ahora antes
de consultar marca y existe una prueba negativa. Nombres extensos se acotan
en encabezado/pie para evitar ocupar el contenido.

## Límites reales del entorno

La ruta de la referencia de la conversación anterior no existe en este host.
Se conservaron los patrones medidos previamente; no se afirma una comparación
pixel a pixel nueva. Las muestras usan el logo local del producto únicamente
como dato de QA. Learning/Storage se verificó con contratos simulados; no se
probó una cuenta real porque no hay sesión disponible en este entorno.
La vista de Word conserva estructura y marca, sin reproducir toda su paginación.
Solo se admiten logos bitmap; los ausentes/incompatibles se informan.

El workspace recibe también cambios audiovisuales ajenos durante esta tarea;
se preservan. No se modificaron secretos, configuración local ni datos remotos.
No se creó instalador, PR ni despliegue.

## Reversión

La preferencia `useOrganizationBranding: false` permite omitir marca por encargo.
Revertir solo el diff de esta implementación devuelve el estilo editorial y
su lectura, sin migración o limpieza de bucket. Los documentos ya creados
conservan sus bytes y no dependen del recurso remoto original.
