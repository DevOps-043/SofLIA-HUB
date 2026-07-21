# Estandar de base de datos

## Instancias

- `database/lia/`: `VITE_SUPABASE_URL`; chat, monitoreo, reuniones, SDO y
  estado operativo del Hub.
- `database/iris/`: proyectos, issues, CRM y workflows compartidos.
- `database/sofia-learning/`: identidad, usuarios y datos compartidos con
  SofLIA Learning.
- `database/shared/`: auditorias o cambios que declaran explicitamente varias
  instancias.

## Reglas

- Cada SQL debe indicar instancia, precondiciones, impacto e idempotencia.
- Snapshots son contexto y no deben ejecutarse como migraciones.
- Una migracion destructiva debe incluir consulta previa, respaldo y rollback.
- Verificar RLS para SELECT, INSERT, UPDATE y DELETE.
- No confiar solo en aislamiento de aplicacion cuando existe `auth.uid()`.
- Mantener `trace_id` e `idempotency_key` en workflows que produzcan efectos.
- Registrar la ejecucion real fuera del repositorio; un archivo SQL no prueba que
  una migracion haya sido aplicada.
