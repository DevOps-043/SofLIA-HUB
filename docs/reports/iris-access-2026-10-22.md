# Precondiciones de acceso e integridad IRIS

Estado: inspección de metadatos confirmada el 2026-10-22; remediación no aplicada.

Se identificó IRIS como Project Hub mediante el host del contrato OpenAPI
versionado y el proyecto conectado `cffppwlfymakieshnzuv`. Sólo se consultaron
catálogos y asesores, sin leer registros de negocio, secretos, tokens ni .env.
[Metadatos obtenidos](iris-access-2026-10-22.json) y
[consultas reproducibles](../../database/iris/audits/project-deletion-preflight.sql).

## Hechos comprobados

- El asesor de seguridad registra 30 tablas públicas sin RLS, incluidas
  pm_projects, task_issues, account_users y tablas de sesiones propias. Ver
  [criterio del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- El grafo revisado tiene 19 tablas y 23 relaciones entrantes; doce de esas
  tablas tienen RLS desactivado y privilegios de escritura para anon y
  authenticated. Otras siete tienen RLS activado sin políticas.
- workspace_members permite SELECT y ALL con USING true al rol public.
  workspaces no compara al actor en su política SELECT. RLS activado por sí
  solo no demuestra aislamiento. No se probó explotación ni lectura REST.
- No se encontró función pública de borrado cuyo nombre contenga project y
  delet. El cliente actual no usa RPC: hace cuatro peticiones independientes,
  consulta project_members aunque no figura en el snapshot y decide éxito
  sólo con la última respuesta.
- task_issues tiene project_id, sin FK hacia pm_projects en el grafo efectivo.
  También hay dependencias sin cascada y referencias entre issues/comentarios;
  borrar sólo proyecto o sólo issues no resuelve el conjunto de invariantes.
- account_users tiene identidad propia y sofia_user_id, sin FK hacia auth.users
  en las restricciones revisadas. No hay evidencia suficiente para sustituir
  esa identidad por auth.uid() de IRIS.
- La API Project Hub v1 local expone lectura/creación/actualización de proyectos,
  sin contrato de borrado. Su canje SOFIA no convierte por sí solo las peticiones
  directas heredadas en peticiones autenticadas a IRIS.

El asesor de rendimiento devuelve 66 FK sin índice cubriente, 24 índices sin
uso registrado, seis casos de políticas permisivas múltiples y un índice
duplicado. Son señales para validar con planes/carga: no autorizan retirar
índices sólo por esa observación.

## Decisión de implementación

El arreglo de borrado requiere una operación transaccional en el servidor
autorizado de Project Hub, con comprobación de actor/workspace/proyecto,
selección exacta de dependencias, resultado verificable y pruebas de rollback
y dos actores. No se sustituye eliminación por archivado ni se inventa un RPC
que el servidor no tiene.

Antes de retirar acceso directo se deben conciliar lectores/escritores
heredados y desplegar los contratos equivalentes detrás de la sesión verificada.
Entonces preparar permisos/RLS y pruebas positivas/negativas por operación,
respaldo, orden de rollout y rollback sin reabrir acceso indiscriminado.
Habilitar RLS sin esa transición rompería consumidores; agregar SECURITY DEFINER
o confiar en un user_id enviado por el cliente no arreglaría la autorización.

No se ejecutaron migraciones ni escrituras remotas. Este reporte reduce la
incertidumbre del diagnóstico y corrige documentación; no declara resueltos
RLS, integridad de borrado ni el porcentaje global de deuda.
