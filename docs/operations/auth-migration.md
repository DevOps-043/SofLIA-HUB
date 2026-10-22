# Migración del login de Soflia Hub a Supabase Auth

Fecha: 2026-07-08. Actualizado: 2026-08-05.
Estado: **Implementado** — `public.users` ya no almacena hashes de contraseña.

---

## Problema (causa raíz confirmada)

SofLIA Learning migró las credenciales a **Supabase Auth** (`auth.users`, mayo
2026), pero Soflia Hub todavía dependía del RPC legado `authenticate_user`. Esa
dependencia se retiró y el esquema actual ya no contiene una columna de hash en
`public.users`; esa tabla conserva únicamente perfil e identidad de negocio.

El diagnóstico operativo actual no inspecciona hashes. Compara el UUID y correo
de `public.users` con `auth.users`, la confirmación del correo y la última sesión.

## Solución implementada

El login de escritorio valida contra **Supabase Auth** (una sola fuente de verdad):

1. **Hub desktop** — `src/services/sofia-auth.ts` + `src/services/sofia-auth/login.ts`:
   - Resuelve email/username → fila de `public.users` (mismo UUID que `auth.users`).
   - `supabase.auth.signInWithPassword({ email, password })`.
   - Perfil, organizaciones y membresías se siguen leyendo de `public.users` (sin cambios).
   - Mensajes de error genéricos (anti-enumeración de cuentas).
La antigua autenticación de Project Hub por WhatsApp fue retirada. La identificación SOFIA por teléfono permanece en `electron/sofia/phone-auto-auth.ts`, sin crear usuarios o consultar equipos IRIS.

El RPC `authenticate_user` **ya no se usa en ningún punto del Hub**.

## Importante: los usuarios NO deben cambiar su contraseña

Con este cambio, todos entran al Hub con **la misma contraseña que ya usan en
Learning**. No se requiere ninguna acción de los usuarios normales.

## Actualización 2026-08-07: cuentas creadas por SSO

La migración anterior asumía que toda cuenta con acceso a Learning tenía
contraseña en `auth.users`. No es cierto para las que nacen del SSO propio de
Learning: su `createUserFromOAuth` crea el usuario en Auth **sin contraseña**
(`admin.createUser` sin el campo `password`). Esas personas entran a Learning con
Google o Microsoft sin problema, pero `signInWithPassword` les falla siempre, de
modo que hasta ahora no podían entrar al Hub por ninguna vía.

La solución **no** es asignarles una contraseña. El Hub gana una segunda entrada,
"Continuar con SofLIA Learning", que delega la identidad en Learning y recibe de
vuelta una sesión SOFIA legítima mediante un ticket de un solo uso. Ver el cambio
`openspec/changes/federate-learning-sso-desktop` y la sección correspondiente de
`docs/operations/configuration.md`.

## Queries de soporte

Todas las queries (correspondencia de identidad, cuentas huérfanas y confirmación)
viven en **`database/sofia-learning/migrations/auth-supabase-hub.sql`**, organizadas por secciones:

> Ejecutar este archivo exclusivamente en el proyecto Supabase de
> **SofLIA Learning/SOFIA**. No ejecutarlo en **Soflia Hub/Lia**: esa instancia
> almacena conversaciones y no contiene `public.users`. El script incluye una
> guarda que detiene el lote con una instrucción clara si se abre el proyecto
> equivocado.

- **Sección 1**: compara perfil y Auth por UUID, correo y confirmación.
- **Sección 2**: detecta perfiles sin identidad Auth del mismo UUID.
- **Sección 2B**: identifica cuentas que iniciaron sesión pero cuya confirmación
  de correo quedó únicamente en `public.users`; también detecta UUID o correos
  incoherentes que deben revisarse manualmente.

Todas son de solo lectura. El archivo no consulta hashes, no crea columnas y no
contiene una sección de limpieza destructiva.

## Rollback

No restaurar el RPC ni una columna de credenciales en `public.users`. Ante una
regresión del cliente, volver a una versión que continúe autenticando contra
Supabase Auth y conservar intactos los UUID de `auth.users`.

## Cómo probar

1. `npm run dev` → login en el Hub con una cuenta migrada usando su contraseña
   actual de Learning → debe entrar.
2. Login con username (no email) → debe entrar.
3. Contraseña incorrecta → "Credenciales invalidas" (sin distinguir usuario inexistente).
4. Usuario suspendido / sin membresía → mensaje de acceso denegado y sesión cerrada.
5. WhatsApp: flujo de autenticación por credenciales → debe aceptar la contraseña actual.
6. Cambiar contraseña en Learning → reintentar login en Hub con la nueva → debe entrar
   sin sincronización manual (misma fuente de verdad).
