# Verificación de recursos y chats del proyecto

Fecha: 2026-10-24. Implementación local; sin operaciones en cuentas reales.

## Resultado y contratos

El encabezado pierde Añadir colaborador/Añadir tarea. Archivos unifica archivos del destino del usuario, documentos y evidencias previas en cuadrícula, con una búsqueda sobre lo cargado y paginación. Mantiene descargas históricas y estados parciales. Añadir archivo usa el destino existente del proyecto. Vincular Drive abre un diálogo con carpetas, archivos y paginación de la cuenta, sin pedir título/URL. Main revalida la selección y confirma el vínculo a IRIS; el archivo original permanece en Drive.

La vista previa local usa lectura acotada de PDF, imágenes PNG/JPEG/WebP y texto de hasta 8 MiB. Rechaza rutas, formatos ejecutables, enlaces simbólicos, archivos grandes y sustituciones del handle. PDF usa el lector existente; imágenes y texto se presentan sin HTML ejecutable. Archivos de proveedor abren su visor dentro del navegador de Soflia. Otros formatos locales muestran la limitación. Los tres canales nuevos mantienen servicio, handler, allowlist, preload y wrapper tipados, con pruebas de contrato completo.

Páginas web lista lo guardado y conserva detalle de colecciones previas. El navegador ofrece Guardar página en un proyecto de la organización activa, eligiendo un proyecto editable y conservando su título/URL saneada. No guarda cookies, sesiones ni texto de la página. El diálogo usa la coordinación existente para retirar temporalmente la vista web nativa.

Chats conserva vínculos federados anteriores y consulta una carpeta personal persistente cuando no existe federación. Consultar no escribe; Nuevo chat verifica acceso al proyecto y crea una única carpeta con ID determinista por actor/organización/workspace/proyecto, usando la sesión Lia y RLS existentes. Un fallo de conexión no se interpreta como ausencia de vínculo. No se comparten chats personales automáticamente ni se infiere asociación por nombre. Crear/abrir reutiliza el chat principal; la flecha junto al modelo regresa al listado. Actualizar chats reintenta lecturas y conversaciones.

## Evidencia ejecutada

- 187 casos aprobados, cero fallos en doce archivos: ProjectWorkspace, useProjectWorkspace, ProjectResources, project-chat-space, UnifiedProjectHub, ProjectManagement, IntegratedBrowserPanel, BrowserWorkspaceLayout, project-cloud-storage, project-location-files, project-creation-ipc y project-hub-bridge.
- Pruebas del resolver contra un doble de consulta Supabase: lectura sin escrituras, persistencia recuperable, aislamiento por actor/organización/proyecto, vínculo anterior, lector sin creación, cancelación y ausencia del contrato federado frente a error transitorio.
- Contrato IPC real con servicio simulado: lista de Drive, selección vinculada, confirmación cancelada, payload inválido, lectura de vista previa y allowlist.
- Smoke Electron: `node test/manual/project-resources/smoke.mjs <directorio>` completado. Se inspeccionaron ocho capturas: archivos claro/oscuro, selector Drive, vista previa, páginas guardadas, elección de proyecto, chats y ancho de 390 px. No hay desbordamiento del documento ni errores de página. La fixture usa datos simulados, sin el preload ni credenciales del producto.
- `npm run verify:pr` aprobado: arnés, supply chain, documentación de sistema/enlaces, catálogo de skills, OpenSpec estricto, pruebas de calidad, typecheck y lint incremental. Suite general: **519 archivos aprobados, dos omitidos; 5.887 casos aprobados, cinco omitidos, cero fallos**, en 117,59 s. `npm run docs:system:check` y `npm run docs:check` también se ejecutaron tras actualizar el catálogo IPC derivado.

## Revisión de riesgos

Se intentó atravesar la carpeta con rutas relativas/absolutas, leer HTML como contenido activo, seleccionar archivos de otro usuario/cuenta y escribir sin rol. También se comprobaron resultados tardíos, cancelación, fallos parciales y texto con etiquetas/acentos. Los casos mantienen las restricciones o muestran el error. La cuadrícula no oculta los archivos de fuentes sanas cuando otra falla.

Límites: no se probaron cuentas reales de Google/Microsoft ni RLS desplegada; la suite no acredita que la sesión local del usuario esté conectada. Una referencia cuyo guardado sea incierto debe revisarse antes de repetir; no existe transacción entre el proveedor y la base. El listado aplica búsqueda local sobre las páginas cargadas. Abrir el contenido de proveedores requiere que su cuenta tenga acceso. La preparación personal no reemplaza un sistema de chat compartido ni aplica migraciones.

Reversión: retirar los tres canales y restaurar componentes/resolver anteriores. Conservar las referencias y carpetas creadas, sin borrado automático ni migración de datos.
