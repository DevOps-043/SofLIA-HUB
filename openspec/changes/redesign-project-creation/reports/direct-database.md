# Proyectos con base de datos directa

Fecha: 2026-10-24. Estado: implementado, con pruebas locales; aceptación con cuenta real pendiente. Reemplaza la propuesta de publicar el parche web.

## Decisión y alcance

Por instrucción del usuario, el Hub usa los clientes Supabase IRIS/SOFIA existentes en Electron main. La instancia de producción conserva la fachada y los canales `project-hub`, pero delega a `DirectProjectBackend`: no contacta el servidor de Project Hub, no canjea tokens SOFIA con éste y no inicia ese servidor en `npm run dev`. El transporte anterior sólo permanece para contratos y consumidores explícitos; no es fallback de producción.

La sesión debe estar verificada en main con SOFIA. Se comprueba la organización seleccionada y su membresía activa en Learning antes de acceder a IRIS. Se resuelve el workspace por `sofia_org_id`, se sincronizan espejos ausentes desde esa identidad comprobada y se preservan roles existentes y bloqueos de acceso. La propiedad se registra atómicamente con el proyecto en `created_by_user_id` y se presenta como integrante propietario al leerlo.

Crear un proyecto no consulta equipos por defecto ni exige que exista alguno. Un equipo indicado explícitamente debe pertenecer al espacio activo. Las lecturas y mutaciones de las secciones usan las tablas existentes con filtros de workspace/proyecto, controles de rol, referencias y revisión cuando corresponde. No se agregaron secretos, canales, tablas ni políticas.

## Verificación

- Suite completa: 5802 pruebas aprobadas, cinco omitidas y cero fallos en la ejecución del cambio. Los ajustes posteriores de tipos y casos adicionales se vuelven a verificar de forma focalizada.
- La suite directa usa el SDK Supabase real con un transporte simulado: comprueba solicitudes a las tablas, filtros y escrituras. El `fetch` global falla deliberadamente si se intenta contactar otro servidor. Cubre creación sin equipo, backend de producción, identidad, organización ajena, ausencia de membresía, lector, A/B/A, consulta tardía y escritura incierta, secciones del proyecto, equipo privado, colaboradores ajenos y efecto parcial de evidencia.
- La creación configurada se prueba junto al servicio directo y a la persistencia de ubicación, conservando el destino cloud simulado y sin visitar la API web.
- Grupo focalizado final: 123 pruebas aprobadas, cero fallos, incluyendo 22 casos de acceso directo. Se añaden verificaciones posteriores a la suite completa; los grupos se solapan y no se suman como casos únicos.
- Lint incremental: 54 archivos revisados sin deuda nueva. Documentación, inventario, arnés, OpenSpec y pruebas de calidad correctos en la compuerta. Typecheck/`verify:pr` conservan el bloqueo previo de `electron/gmail/raw-message.ts:19`, opción `newline`; los errores de tipos introducidos durante esta implementación se corrigieron.

## Revisión adversarial y límites

Las credenciales no cruzan al renderer. Se intentó usar otro workspace, usuario, organización o equipo; los casos se rechazan. El contexto invalida resultados al cambiar de sesión o revisión de organización y la descarga conserva también una guarda síncrona de selección. Las opciones de equipo ocultan equipos privados sin acceso. Los rechazos de base de datos devuelven mensajes locales sin incluir detalles internos.

Antes de cada escritura se vuelve a comprobar la membresía activa de Learning y del workspace y, en operaciones de un proyecto, el permiso de escritura o administración. Una revocación durante la preparación se prueba como caso negativo, sin enviar el PATCH.

Los cambios compuestos de tablas no tienen una transacción cliente: se señalan resultados parciales/inciertos y no se reenvían ni se borran efectos como compensación. La importación transaccional de reuniones conserva el RPC existente y sus permisos; puede estar denegada al cliente configurado, sin fallback web ni elevación a service role. La subida histórica a Storage permanece desactivada; archivos nuevos usan local/Drive/OneDrive y las descargas históricas usan URLs firmadas directas con las validaciones anteriores.

Los bindings colaborativos de chats existentes se conservan como lectura. La creación directa no promete ejecutar el antiguo worker web de outbox ni crear un nuevo binding Lia; no modifica las políticas de federación o conversaciones para simularlo.

La autorización de main no equivale a una remediación global de RLS/grants. La auditoría IRIS previa sigue vigente y no se amplían permisos anónimos ni se ejecutan migraciones. Las tablas y permisos remotos deben permitir la operación con la conexión configurada; un fallo se muestra y no activa la API como sustituto. No se usaron credenciales reales, ni se crearon proyectos o archivos en las cuentas del usuario durante estas pruebas.

## Reversión

La unidad de composición de producción es `getProjectHubApiService()` en `electron/project-hub/service.ts`; revertir este cambio restaura el backend previo y el canje. No hay cambios de esquema que revertir. Los proyectos ya insertados y carpetas preparadas se conservan; no se borran como parte de una reversión de código.
