# Base de datos

- `lia/`: instancia operativa del Hub (`VITE_SUPABASE_URL`).
- `iris/`: proyectos, CRM y workflows.
- `sofia-learning/`: identidad y plataforma compartida.
- `shared/`: auditorias y cambios multi-instancia.

Cada instancia separa `migrations/` ejecutables de `snapshots/` informativos.
Leer `docs/standards/database.md` antes de modificar SQL.
