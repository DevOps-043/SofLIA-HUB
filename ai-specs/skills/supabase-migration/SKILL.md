---
name: supabase-migration
description: Diseña, ubica y revisa migraciones para las instancias SOFIA, Lia o IRIS con RLS, idempotencia y rollback. Úsala cuando cambien tablas, políticas, índices, funciones o contratos de persistencia Supabase.
---

# Crear una migración Supabase

1. Leer `docs/standards/database.md` y confirmar la instancia propietaria del dominio.
2. Inspeccionar el snapshot y las migraciones relacionadas; no inferir esquemas por nombre.
3. Crear una migración incremental en `database/<instancia>/migrations/` con nombre descriptivo.
4. Diseñar reejecución segura, constraints, índices y política de rollback.
5. Definir RLS por actor y operación. Negar por defecto y evitar service-role en renderer.
6. Actualizar clientes y tipos afectados sin duplicar la lógica de acceso.
7. Verificar consultas positivas, aislamiento entre organizaciones y accesos denegados.
8. Documentar orden de aplicación, impacto y evidencia en OpenSpec.

No ejecutar una migración remota ni modificar datos reales sin autorización explícita.
