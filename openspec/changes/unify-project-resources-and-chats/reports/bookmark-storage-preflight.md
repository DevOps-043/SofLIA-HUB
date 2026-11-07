# Guardado de páginas: aviso y acceso a almacenamiento

Fecha: 2026-10-24. Preflight histórico: aviso técnico retirado y causa remota confirmada. El usuario autorizó después la corrección desde las bases; la aplicación y evidencia posteriores están en el [reporte de corrección](project-storage-database-fix.md).

## Cambio local autorizado

El usuario autorizó quitar la confirmación adicional al guardar una página. La excepción sólo admite el marcador explícito del navegador con título y URL http/https saneada, referencia coincidente, metadatos cerrados y cero elementos. No acepta resumen, texto de pestaña, adjuntos ni metadatos extra. No cambia otras operaciones críticas. Main mantiene validación de payload, ventana/frame/sesión y el backend comprueba organización, membresía y permisos del proyecto. No se envían IDs ni JSON a un diálogo nativo en este flujo.

El rechazo remoto se presenta como almacenamiento del proyecto aún no habilitado; no se declara éxito ni se crea una copia local como sustituto.

## Inspección remota de sólo lectura

Se identificó IRIS/Project Hub por el proyecto conectado `cffppwlfymakieshnzuv`, coincidente con el reporte canónico de acceso anterior. Se consultaron catálogos de tablas, privilegios, columnas, políticas y funciones desplegadas. No se leyeron filas de negocio ni secretos.

Hechos: `pm_project_documents`, `pm_project_evidence` y `pm_project_evidence_items` tienen RLS activado, privilegios INSERT/SELECT concedidos a los roles clientes y **cero políticas**. Por tanto, conceder privilegios de tabla no basta: sus escrituras siguen denegadas. La consulta acotada de logs no devolvió eventos coincidentes y no se interpreta como ausencia del fallo. No hay Edge Functions desplegadas en esa instancia.

El cliente IRIS de main se crea sin sesión de usuario IRIS; la identidad SOFIA se comprueba en la aplicación, pero no se convierte en `auth.uid()` de IRIS. Una política que sólo acepte authenticated no arregla por sí sola esta conexión. El reporte [de acceso IRIS](../../../../docs/reports/iris-access-2026-10-22.md) ya identificaba esta separación y la ausencia de RLS en otras tablas de autoridad. No hay un arreglo exclusivamente de interfaz que permita guardar de forma segura.

## Cambio remoto que requiere revisión y autorización

Resultado propuesto: autenticar la conexión de IRIS con una identidad verificable de Learning y limitar el almacenamiento al proyecto/organización autorizados, manteniendo acceso directo a Supabase y sin depender del servidor web de Project Hub.

1. Configurar IRIS para confiar en el emisor OIDC de Learning mediante Custom OIDC Third-Party Auth. Se verificaron los endpoints públicos de descubrimiento y JWKS de SOFIA: el emisor es `https://mrqnnmuckznvukjvfkly.supabase.co/auth/v1` y publica dos claves ES256. Esto permite evaluar autenticación directa sin servidor web de Project Hub ni nueva Edge Function. La integración aún no está configurada ni probada contra IRIS. Según la [documentación oficial](https://supabase.com/docs/guides/auth/third-party/custom-oidc), se configura mediante Dashboard o Management API, no mediante CLI. La clave pública o un `user_id` enviado por el cliente no prueban identidad. No empaquetar service_role ni contraseñas de base en Electron.
2. Conciliar la identidad de auth de IRIS con `account_users.sofia_user_id` y cerrar las escrituras anónimas en las fuentes de autoridad afectadas (`account_users`, `workspaces`, `workspace_members`, `pm_projects`, `pm_project_members`) antes de basar políticas en ellas. Mantener compatibilidad de consumidores identificados y rollback, sin activar una política permisiva como sustituto.
3. Desplegar políticas SELECT/INSERT/UPDATE por actor y acceso al proyecto en evidencias/items/documentos; incluir aislamiento de organización, denegación a lectores y control de propiedad. No habilitar acceso anónimo ni retirar RLS.
4. Actualizar el cliente main para entregar el JWT vigente mediante `accessToken` y revalidarlo tras cambio de organización/logout. Las políticas deben comprobar el emisor confiable además del sujeto y el acceso al proyecto. Probar dos actores de organizaciones diferentes, lector, propietario, revocación y reintento, y ejecutar una lectura/escritura controlada con restauración explícita.

Al cerrar este preflight no se había aplicado ninguna migración, función, política ni cambio remoto de privilegios. El alcance identificado incluía autenticación y tablas de autoridad. La autorización explícita posterior permitió implementar la alternativa de verificación desde las bases descrita en el reporte enlazado; la propuesta OIDC de esta sección se conserva como alternativa evaluada.

## Verificación local

Pruebas dirigidas del handler, bridge, backend directo y UI: 242 aprobadas. Casos nuevos: no diálogo nativo al guardar un marcador, rechazo de la excepción para contenido adicional, sesión/origen inválidos y error de almacenamiento sin éxito falso.

`npm run verify:pr` terminó con código 0: tipos, arnés, documentación, especificaciones, lint sin deuda nueva y suite completa (5.901 pruebas aprobadas; 5 omitidas, 519 archivos aprobados y 2 omitidos). Evidencia local: `bookmark-review-tests.json` y `bookmark-review-gate.log` en el directorio de trabajo de esta conversación. No se hizo una escritura real ni se comprobó guardado exitoso en IRIS.

## Revisión adversarial

Se intentó refutar que la excepción esté limitada a un marcador: título/URL válidos, referencia coincidente, metadatos cerrados y ausencia de elementos; resumen, texto, metadatos extra y URL sin sanear conservan la revisión existente. Se comprobó que el handler sigue validando origen y sesión antes de operar, y que un rechazo remoto conserva `success: false`. No se cambian RLS, privilegios ni políticas desde el código local. Riesgo residual conocido: el guardado real sigue denegado hasta completar y verificar la autenticación y las políticas remotas; la mejora del mensaje no resuelve ese bloqueo.
