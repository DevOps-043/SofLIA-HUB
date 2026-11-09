## Decisiones

La interfaz reutiliza el diálogo interno, la cuadrícula de archivos, el selector de Drive y el chat principal. El marcador explícito del navegador no muestra una segunda revisión técnica. Los contratos IPC existentes permanecen cerrados.

## Guardado directo con identidad verificable

El usuario autorizó el 2026-10-24 los cambios de base requeridos para corregir el rechazo. Un JWT de Learning no se convierte en una sesión de IRIS por enviar un UUID. Se evaluó Custom OIDC, pero necesita configuración de plataforma fuera de SQL y no aporta por sí mismo la membresía organizativa vigente. Para cumplir la corrección desde las bases se utiliza el hook oficial `pgrst.db_pre_request` de IRIS y la extensión `http`.

Main añade el token vigente de Learning, su clave pública y la organización seleccionada a las peticiones REST de la instancia IRIS exacta. Rechaza redirecciones y cambios de ámbito. No cambia `Authorization` de IRIS, no eleva el rol Postgres y no expone estos datos al renderer. IRIS no confía en las cabeceras como prueba: consulta únicamente el RPC fijo `hub_project_scope_v1` de Learning con ese token. El gateway de Learning verifica la sesión y el RPC `SECURITY INVOKER`, bajo sus RLS, devuelve sólo la identidad propia y la membresía activa de la organización pedida. No acepta actor ni rol como argumentos.

El hook privado limpia el contexto al comenzar y sólo lo establece dentro de la transacción tras una respuesta válida. La verificación tiene un timeout de tres segundos y falla cerrada. Las políticas conservan los roles de transporte `anon`/`authenticated`, pero ambos requieren ese contexto verificado: la clave pública sola no permite filas. Sin cabeceras, Storage/Realtime o peticiones de otro cliente no reciben contexto. Las comprobaciones de organización y rol se repiten contra Learning en cada petición; no hay caché de membresías ni copia de tokens en tablas.

Las autoridades afectadas son `account_users`, `workspaces`, `workspace_members`, `pm_projects` y `pm_project_members`; sus escrituras dejan de ser anónimas sin identidad. Los perfiles se crean sólo para el sujeto verificado, sin conceder permisos globales, y su lectura excluye el hash de contraseña. El rol organizativo proviene de Learning, no del espejo de IRIS. Los lookups privados de RLS no mutan datos; evitan recursión entre proyectos y miembros. El RPC heredado que transfería propiedad sin comprobar actor queda reservado al servidor; el backend directo no lo usa.

## Aplicación, compatibilidad y recuperación

Primero se despliega la función de lectura en SOFIA y después la migración transaccional de IRIS. No se sustituyen hooks ajenos. La nueva versión de main publica las cabeceras automáticamente; clientes anónimos antiguos dejan de acceder a las ocho tablas protegidas. Los consumidores con privilegios de servidor conservan su vía. Se verifican creación con RETURNING, lectura, guardado, aislamiento de organizaciones, lector, miembro, administrador y ausencia/revocación de contexto. Las pruebas con fixtures se revierten en la misma transacción.

La contención retira el hook y deja RLS cerrado, sin borrar filas ni restaurar las políticas anónimas anteriores. No se presenta como rollback funcional hacia el acceso inseguro. La extensión no se elimina porque podría tener nuevos consumidores.

## Límites

El hook protege la Data API; Storage y Realtime no heredan su contexto. El contenido de archivos sigue en el equipo, Drive o OneDrive del usuario. Esta unidad no constituye una auditoría ni remediación de todas las tablas históricas de IRIS. La disponibilidad y latencia de Learning forman parte de cada petición protegida; se registra esta dependencia y se verifica el flujo real antes de declarar resuelto el guardado.
