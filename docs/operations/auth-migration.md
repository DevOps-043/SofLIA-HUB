# Migración del login de Pulse Hub a Supabase Auth

Fecha: 2026-07-08
Estado: **Implementado en código** — pendiente deploy + limpieza de BD

---

## Problema (causa raíz confirmada)

SofLIA Learning migró las contraseñas a **Supabase Auth** (`auth.users`, mayo 2026),
pero Pulse Hub seguía validando login con el RPC `authenticate_user`, que compara
contra **`public.users.password_hash`** usando pgcrypto. Esa columna quedó congelada:

| Estado de `password_hash` | Resultado en el Hub |
|---|---|
| `NULL` (usuarios nuevos post-migración) | Login imposible |
| `$2b$...` (bcrypt de JS, bug previo) | pgcrypto no verifica `$2b$` → login imposible |
| `$2a$...` (pgcrypto, pre-migración) | Funciona solo con la contraseña VIEJA |

Verificado con la query "Estado de hash y presencia en auth" (SQL Editor, 2026-07-08):
usuarios con hash `NULL`/`$2b$` sí tienen `last_sign_in_at` en `auth.users` — es decir,
entran a Learning sin problema; el Hub era el único validando contra la columna muerta.

## Solución implementada

Ambas rutas de login ahora validan contra **Supabase Auth** (una sola fuente de verdad):

1. **Hub desktop** — `src/services/sofia-auth.ts` + `src/services/sofia-auth/login.ts`:
   - Resuelve email/username → fila de `public.users` (mismo UUID que `auth.users`).
   - `supabase.auth.signInWithPassword({ email, password })`.
   - Perfil, organizaciones y membresías se siguen leyendo de `public.users` (sin cambios).
   - Mensajes de error genéricos (anti-enumeración de cuentas).
2. **Login por WhatsApp** — `electron/iris/auth/credential-auth.ts` +
   `electron/iris/auth/password-verifier.ts`:
   - Misma resolución de identificador.
   - Verificación con **cliente efímero** (sin `persistSession`) para no contaminar
     el cliente SOFIA memoizado del main process.

El RPC `authenticate_user` **ya no se usa en ningún punto del Hub**.

## Importante: los usuarios NO deben cambiar su contraseña

Con este cambio, todos entran al Hub con **la misma contraseña que ya usan en
Learning**. No se requiere ninguna acción de los usuarios normales.

## Caso borde único (no es un cambio de contraseña)

### Cuentas que no tienen contraseña NI en Supabase Auth

Son cuentas que nunca terminaron su alta: hoy no pueden entrar ni a Learning ni al
Hub. La query de diagnóstico mostró solo una (`ernesto.hernandez@soflia.ai` — y ese
usuario ya entra con su otro correo `@ecosdeliderazgo.com`, así que probablemente no
haya que hacer nada). Si aparece alguien más: Dashboard → Authentication → Users →
⋮ → "Send password recovery".

## Queries de soporte

Todas las queries (diagnóstico, detección de cuentas huérfanas y limpieza futura)
viven en **`database/sofia-learning/migrations/auth-supabase-hub.sql`**, organizadas por secciones:

- **Sección 1 y 2**: solo lectura — ejecutar cuando se quiera.
- **Sección 2B**: identifica cuentas que iniciaron sesión pero cuya confirmación
  de correo quedó únicamente en `public.users`; también detecta UUID o correos
  incoherentes que deben revisarse manualmente.
- **Sección 3 (limpieza)**: destructiva y comentada — NO ejecutar hasta que Learning
  confirme que tampoco usa los RPCs. Beneficio al completarla: se elimina el
  almacenamiento duplicado de credenciales.

## Rollback

Revertir los commits de `sofia-auth` — el RPC `authenticate_user` sigue existiendo
en la BD, por lo que el flujo viejo vuelve a funcionar de inmediato (con sus bugs).

## Cómo probar

1. `npm run dev` → login en el Hub con un usuario `$2b$`/`NULL` (ej. los reportados)
   usando su contraseña ACTUAL de Learning → debe entrar.
2. Login con username (no email) → debe entrar.
3. Contraseña incorrecta → "Credenciales invalidas" (sin distinguir usuario inexistente).
4. Usuario suspendido / sin membresía → mensaje de acceso denegado y sesión cerrada.
5. WhatsApp: flujo de autenticación por credenciales → debe aceptar la contraseña actual.
6. Cambiar contraseña en Learning → reintentar login en Hub con la nueva → debe entrar
   sin sincronización manual (misma fuente de verdad).
