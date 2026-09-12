# Base de datos

- `lia/`: instancia operativa del Hub (`VITE_SUPABASE_URL`).
- `iris/`: proyectos, CRM y workflows.
- `sofia-learning/`: identidad y plataforma compartida.
- `shared/`: auditorias y cambios multi-instancia.

Cada instancia separa `migrations/` ejecutables de `snapshots/` informativos.
`sofia-learning/` es compartida con SofLIA Learning: sus migraciones deben ser
aditivas y no alterar permisos, politicas ni RLS de tablas que ese producto ya
usa. Los snapshots no incluyen GRANT ni politicas, asi que no sirven para
deducir quien puede leer que.
`lia/rollbacks/` contiene reversión operativa manual; no aplicar sus archivos
como parte de una migración normal. El esquema de sync cifrado está preparado
localmente; eso no demuestra su aplicación en Lia.
Leer `docs/standards/database.md` antes de modificar SQL.
