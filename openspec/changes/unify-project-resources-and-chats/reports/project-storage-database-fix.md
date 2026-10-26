# Corrección del almacenamiento de proyectos desde las bases

Fecha del usuario: 2026-10-24. Autorización: «sí, autorizo, todo hazlo desde la base de datos». Estado: migraciones aplicadas y pruebas remotas controladas aprobadas; smoke con sesión real en la interfaz pendiente.

## Resultado y contrato

Se corrigió la ausencia de políticas para evidencias/documentos y la falta de identidad verificable en las consultas de IRIS. Learning expone sólo una lectura del ámbito propio bajo su sesión y RLS. IRIS la consulta desde un verificador privado antes de ejecutar la petición y usa el resultado dentro de la transacción para aplicar las políticas. No hay servidor web de Project Hub, Edge Function, clave privilegiada en Electron ni almacenamiento de tokens en tablas. Las cabeceras no son una credencial de confianza por sí mismas.

Main incorpora el token vigente y la organización sólo al origen IRIS configurado y la ruta REST. Rechaza redirecciones, identidad distinta y cambio de ámbito A/B/A. Las mutaciones conservan el único intento de red del transporte. El rol organizativo se toma de Learning; un espejo administrativo obsoleto no eleva acceso. Los rechazos de sesión, membresía o disponibilidad se convierten en errores propios sin cuerpos remotos ni éxito falso.

El [diseño](../design.md) detalla compatibilidad, ámbito, límites y recuperación. Los clientes antiguos sin contexto verificado dejan de acceder a las ocho tablas protegidas; el cliente de main ya se actualizó para entregarlo. No se habilitó otra organización por nombre ni se pidió crear un espacio adicional.

## Migraciones y evidencia remota

- SOFIA Learning `mrqnnmuckznvukjvfkly`: `hub_learning_scope`, versión remota `20261025003749`, fuente `database/sofia-learning/migrations/20261025003230_hub_learning_scope.sql`. Función SECURITY INVOKER de lectura propia, sin actor/rol como argumentos; no cambia la configuración Auth ni filas de negocio.
- IRIS `cffppwlfymakieshnzuv`: `hub_project_storage_rls`, versión remota `20261025003839`, fuente `database/iris/migrations/20261025003232_hub_project_storage_rls.sql`.
- IRIS: `hub_storage_grants_indexes`, versión remota `20261025004431`, fuente `database/iris/migrations/20261025004348_hub_storage_grants_indexes.sql`.

El verificador usa `http_set_curlopt` de la extensión HTTP con timeout de tres segundos, conexión de 1,5 segundos y TLS verificado. Una primera aplicación que intentaba configurar esos parámetros mediante SET fue rechazada y se comprobó su rollback completo antes de corregir el mecanismo; no dejó tablas a medio proteger.

Se comprobaron 21 políticas y RLS activo en `account_users`, `workspaces`, `workspace_members`, `pm_projects`, `pm_project_members`, `pm_project_evidence`, `pm_project_evidence_items` y `pm_project_documents`. Los perfiles no exponen password_hash; no se permite reasignar identidad/propietario mediante UPDATE. Las referencias sólo conceden UPDATE de nombre/tipo/fecha. Se restringió al servidor el RPC heredado de transferencia de propietario que el backend directo no utiliza.

El advisor detectó un índice de identidad redundante creado durante esta unidad; la segunda migración retiró únicamente ese duplicado conservando el índice único equivalente previo. Se verificó ausencia de duplicados antes de añadir la unicidad proyecto/usuario requerida por el upsert vigente y los índices de consulta por usuario/creador. No se cambiaron filas de membresía reales.

## Pruebas de base

Se ejecutó `database/iris/audits/project-storage-rls-regression.sql` sobre IRIS con fixtures aleatorios y ROLLBACK: alta propia, creación de espacio y proyecto con RETURNING, guardar/releer marcador, documento y elemento; lectura de viewer sin escritura/edición/borrado; escritura de member; rechazo de actor falsificado, cambio de propiedad, organización ajena aun siendo propietario, miembro desactivado, claims sin contexto y RPC heredado sin permisos. El espejo de viewer se hizo admin deliberadamente y no elevó el acceso.

Estas pruebas simulan el contexto posterior a la verificación, no inventan una sesión criptográfica real. Por separado se probó el RPC de Learning bajo RLS y contexto SQL de authenticated: devuelve sólo la membresía propia y deniega una organización ajena sin modificar datos. El verificador HTTP real de IRIS rechazó un token sintético inválido con PT401.

La Data API real de IRIS respondió HTTP 200 con cero filas de proyectos sin sesión y HTTP 401/PT401 con las cabeceras de sesión inválida. Esto confirma que el hook está activo en REST, además de las pruebas directas de SQL. Al concluir las transacciones se comprobaron cero cuentas de prueba `@example.invalid`, cero evidencias y cero documentos, iguales a los conteos previos. No se guardó un marcador real a nombre del usuario.

## Verificación local y revisión

Las 252 pruebas dirigidas aprobaron e incluyen aislamiento de destino, eliminación de cabeceras ajenas, cambio A/B/A, rol vigente de Learning, traducción segura de errores y la excepción de confirmación sólo para marcadores simples. `npm run verify:pr` terminó con código 0: arnés, especificaciones, documentación, tipos, lint incremental sin deuda nueva y 5.911 pruebas aprobadas/5 omitidas en 520 archivos aprobados/2 omitidos. La evidencia está en `iris-final-tests.json` e `iris-database-gate.log` en el directorio de trabajo de la conversación. Tras completar los valores finales del reporte se repiten las comprobaciones documentales.

Se revisaron hipótesis adversariales de suplantación por UUID/cabeceras/claims, rol de espejo elevado, autor/organización cruzados, funciones heredadas y permisos por defecto. Los lookups SECURITY DEFINER son privados y de sólo lectura; la escritura continúa bajo RLS. Storage/Realtime no heredan el contexto del hook y quedan sin acceso a estas filas por esta vía.

Los advisors conservan avisos históricos de otras tablas sin RLS, políticas ausentes e índices; esta unidad no afirma remediar toda la instancia. La revisión final ya no señala el índice de identidad duplicado de esta unidad; los índices nuevos por usuario/creador figuran como aún no utilizados al no haber tráfico real de la interfaz durante la prueba. Ningún helper nuevo se declara como API pública ni se añaden credenciales persistentes. Referencias oficiales: [verificación por petición](https://supabase.com/docs/guides/api/securing-your-api), [extensión HTTP](https://supabase.com/docs/guides/database/extensions/http) y [advisors de base](https://supabase.com/docs/guides/database/database-advisors).

## Límite de la prueba visual

La aplicación estaba en la pantalla de inicio de sesión tras actualizar main. Se abrió el retorno normal de Learning, pero no se completó el acceso en la app. Computer Use se detuvo porque no pudo determinar la URL del navegador con suficiente certeza para aplicar su política. No se continuó esa automatización ni se extrajeron tokens/credenciales para sustituirla. Falta comprobar guardar y releer una página desde la interfaz con la sesión del usuario iniciada.
