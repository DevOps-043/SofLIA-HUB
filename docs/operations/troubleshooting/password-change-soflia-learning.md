# Cambio de contraseña en SofLIA Learning (guía sustituida)

Estado: **obsoleto; no ejecutar instrucciones históricas**. Actualizado: 2026-08-05.

<!-- evidence: docs/operations/auth-migration.md -->
<!-- evidence: docs/operations/troubleshooting/password-change-login.md -->
<!-- evidence: src/services/sofia-auth/login.ts -->

Esta guía describía el sistema legado que almacenaba credenciales en
`public.users.password_hash` y las validaba mediante RPC/pgcrypto. Ese contrato
ya no existe: SofLIA Learning y Pulse Hub autentican contra Supabase Auth y
`public.users` conserva solo perfil e identidad de negocio.

No se deben crear columnas de contraseña, restaurar RPCs legados, escribir hashes
ni establecer contraseñas temporales mediante SQL. Un cambio o recuperación de
contraseña debe realizarse mediante los flujos autorizados de Supabase Auth.

Para el contrato vigente consulte:

- [Migración del login a Supabase Auth](../auth-migration.md).
- [Conversaciones no disponibles después del login](password-change-login.md).

La versión sustituida contenía datos personales y una credencial de soporte en
texto claro. Esos valores se retiraron del documento vigente. La credencial debe
considerarse expuesta y rotarse mediante Supabase Auth; eliminarla del historial
Git, si el repositorio fue compartido, requiere un procedimiento de saneamiento
separado y coordinado.
