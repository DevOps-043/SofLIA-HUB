# Selector nativo y archivos del usuario

Estado: corrección implementada y verificada localmente. Fecha: 2026-10-24. Reemplaza las decisiones de interfaz y alojamiento de la primera iteración, cuyo reporte se conserva como histórico.

## Comportamiento

- Nuevo proyecto permanece en un diálogo de la ventana principal. Se retiraron el bloque visible de organización y la opción de alojamiento de Soflia. La organización sigue asignada internamente para aislar el listado y el registro de negocio.
- Elegir carpeta y Añadir carpeta llaman al selector nativo de Electron, con `openDirectory` y ventana padre. No se reconstruye un explorador local con React ni se reciben rutas arbitrarias del renderer. Cancelar conserva nombre y selección previa.
- Las opciones son En mi equipo, Google Drive y OneDrive. Los proveedores muestran la cuenta vinculada y permiten seleccionar su carpeta. Una selección no sirve para otro usuario, cuenta o proveedor, y se revalida antes de crear la subcarpeta.
- Drive reutiliza la conexión Google vigente. OneDrive exige la cuenta Microsoft vinculada y permiso delegado `Files.ReadWrite`; usa MSAL público con PKCE/state y caché cifrada separada del calendario. No cambia sus credenciales ni solicita permisos de aplicación sobre todo un tenant.
- Archivos del proyecto lista el destino y añade archivos allí: copia local exclusiva mediante staging, Drive v3 o sesión de subida OneDrive con conflicto `fail`. No invoca la subida de bytes a Storage de Soflia. Las referencias y descargas históricas permanecen accesibles sin migrarlas ni borrarlas.

## Evidencia

- Suite completa: **5732 pruebas aprobadas, 5 omitidas, cero fallos**. Incluye las regresiones del selector, borrador, aislamiento y permisos. Los últimos cambios de texto/recuperación de autorización se validan además con lint y revisión visual.
- Focalizadas de UI/creación/IPC/bridge: 84 casos correctos. Cloud, autorización Microsoft y archivos en destino: 21 casos correctos. Estos grupos se solapan con la suite general y no se suman como ejecuciones distintas de casos únicos.
- Se probaron cancelación nativa, selector vinculado a la ventana principal, payload con ruta inyectada, actor incorrecto, cuenta/proveedor cambiado, permisos de lector, colisión local sin sobrescritura, respuesta remota perdida, autorización de otra cuenta y reenvío de la misma operación.
- En OneDrive se comprobó que los bytes van a la URL de sesión autorizada sin reenviar bearer, que se rechazan hosts y continuaciones ajenos, y que los POST/PUT no usan reintentos automáticos. Las respuestas Graph están acotadas a 2 MiB. El resultado final verifica identidad, tamaño, nombre y unidad del archivo.
- El grant de carpeta conserva la guarda de cuenta, separada del caller de un IPC que ya terminó; desconectar la cuenta invalida su uso posterior.
- Revisión final: 31 casos focalizados aprobados y lint de 40 archivos sin deuda nueva. La carga comprueba la identidad del proyecto y su workspace, y vuelve a consultar el permiso antes de cada escritura; se verificó la revocación del rol durante la confirmación humana.
- Smoke Electron `node test/manual/project-creation/smoke.mjs <directorio>`: modal, selección principal/adicional mediante bridge doble, Drive, OneDrive, un único BrowserWindow para el formulario, claro/oscuro, 320 px, zoom 200 %, Escape y restauración del foco. Capturas inspeccionadas. No abre una cuenta real ni escribe archivos remotos.
- Lint incremental correcto, sin deuda nueva; arnés, enlaces, inventario y OpenSpec estricto correctos. Se actualizaron 531 canales y el inventario derivado de pruebas.
- `npm run typecheck` y `npm run verify:pr` siguen bloqueados por los mismos once diagnósticos previos de correo/Zoom; los archivos nuevos y modificados no añadieron diagnósticos. No se ocultaron ni corrigieron módulos ajenos para cambiar esa evidencia.

## Límites de la verificación

Los proveedores se probaron con dobles de red/cuentas; el filesystem local se probó en temporales reales. No se accedió a credenciales reales ni se crearon proyectos, carpetas o archivos en las cuentas del usuario. Falta la aceptación humana del consentimiento OAuth y de una transferencia con cada cuenta real; permisos, registro OAuth y políticas del tenant pueden impedir una operación, y el flujo lo muestra sin sustituir el destino.

El selector usa la API multiplataforma de Electron; no se certifica una ejecución manual en macOS/Linux desde este host Windows. La captura de interfaz sustituye el selector del sistema por un doble; su contrato nativo se comprueba en IPC. No se promete sincronización offline, importación completa, coedición, ni permisos de Drive/OneDrive concedidos automáticamente a miembros del proyecto.

Los límites existentes son diez archivos por selección y 20 MiB por archivo en los formatos permitidos por el validador. Los listados parciales lo indican. Las configuraciones antiguas `cloud` no se convierten silenciosamente a otra cuenta y no son un destino válido para nuevas cargas. El registro de proyectos/tareas sigue en la API de negocio; los archivos de este flujo se alojan en el destino del usuario.

Google permite nombres duplicados: se comprueba la colisión antes de crear, pero no se promete unicidad frente a un escritor externo concurrente. No se sobrescriben archivos. El diario conserva efectos inciertos sin borrados compensatorios ni reenvíos automáticos. No hay transacción entre proveedor, disco y servidor ni protección absoluta ante un actor con control concurrente del filesystem del usuario.

Referencias consultadas: [carpetas de Drive](https://developers.google.com/workspace/drive/api/guides/folder), [permisos y creación de carpetas OneDrive](https://learn.microsoft.com/en-us/graph/api/driveitem-post-children?view=graph-rest-1.0), [autorización y PKCE con MSAL](https://learn.microsoft.com/en-us/entra/msal/javascript/node/acquire-token-requests).
