# FIX: Cambio de contraseña en SofLIA Learning

## Estado: URGENTE — Usuarios bloqueados

Fecha: 2026-03-24

---

## Problema confirmado

Cuando un usuario cambia su contraseña desde SofLIA Learning, **no puede iniciar sesion en SofLIA Hub**.

### Causa raiz (verificada)

SofLIA Learning hashea la nueva contraseña con **bcrypt de JavaScript** (`bcryptjs` o `bcrypt`) y guarda el resultado en `public.users.password_hash` via UPDATE directo.

SofLIA Hub valida contraseñas con la funcion RPC `authenticate_user`, que internamente usa **`extensions.crypt()`** (pgcrypto de PostgreSQL):

```sql
-- Dentro de authenticate_user:
IF v_user.password_hash IS NULL OR NOT (v_user.password_hash = extensions.crypt(p_password, v_user.password_hash)) THEN
    RETURN json_build_object('success', false, 'error', 'Contraseña incorrecta');
END IF;
```

**bcrypt de JS genera hashes que pgcrypto no puede verificar.** Aunque ambos producen hashes con formato `$2b$10$...`, hay diferencias sutiles en el encoding que hacen que `crypt()` de PostgreSQL devuelva un resultado distinto.

### Prueba realizada

```sql
-- Resultado: false (el hash NO es compatible con pgcrypto)
SELECT password_hash = crypt('Vivaluzu1', password_hash) AS crypt_match
FROM public.users
WHERE email = 'lordget_yt@hotmail.com';
```

---

## Que hay que cambiar en SofLIA Learning

### Paso 1: Ya hecho — Funciones RPC en la BD

Las siguientes funciones ya estan creadas en Supabase (proyecto SofLIA-Learning / mrqnnmuckznvukjvfkly):

- `change_user_password(p_user_id uuid, p_new_password text)` — Para admins o reset de contraseña
- `change_own_password(p_user_id uuid, p_current_password text, p_new_password text)` — Para que el usuario cambie su propia contraseña

Ambas usan `crypt()` + `gen_salt('bf', 10)` de pgcrypto, garantizando compatibilidad con `authenticate_user`.

### Paso 2: Cambiar el codigo de SofLIA Learning

Buscar **TODOS** los lugares donde se cambia `password_hash` en el codigo de SofLIA Learning. Patrones a buscar:

```bash
# Buscar en el codigo de SofLIA Learning:
grep -rn "password_hash" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .
grep -rn "bcrypt" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .
grep -rn "\.update.*password" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .
```

#### Cambio de contraseña por admin o reset

```typescript
// ❌ ANTES (BUG): hash desde JavaScript — INCOMPATIBLE con pgcrypto
import bcrypt from 'bcryptjs'; // o 'bcrypt'
const hashedPassword = await bcrypt.hash(newPassword, 10);
await supabase
  .from('users')
  .update({ password_hash: hashedPassword })
  .eq('id', userId);

// ✅ DESPUES (CORRECTO): hash desde PostgreSQL via RPC
const { data, error } = await supabase.rpc('change_user_password', {
  p_user_id: userId,
  p_new_password: newPassword
});

if (error) {
  console.error('Error de conexion:', error.message);
  // Mostrar error al usuario
  return;
}

if (!data?.success) {
  console.error('Error cambiando contraseña:', data?.error);
  // Mostrar data.error al usuario (ej: "La contraseña debe tener al menos 6 caracteres")
  return;
}

// Exito — la contraseña fue cambiada
```

#### Cambio de contraseña por el propio usuario (requiere contraseña actual)

```typescript
// ❌ ANTES (BUG):
const isValid = await bcrypt.compare(currentPassword, user.password_hash);
if (!isValid) throw new Error('Contraseña actual incorrecta');
const hashedPassword = await bcrypt.hash(newPassword, 10);
await supabase.from('users').update({ password_hash: hashedPassword }).eq('id', userId);

// ✅ DESPUES (CORRECTO): todo se valida y hashea en PostgreSQL
const { data, error } = await supabase.rpc('change_own_password', {
  p_user_id: userId,
  p_current_password: currentPassword,
  p_new_password: newPassword
});

if (error) {
  console.error('Error de conexion:', error.message);
  return;
}

if (!data?.success) {
  // data.error puede ser:
  //   - "Usuario no encontrado"
  //   - "Contraseña actual incorrecta"
  //   - "La nueva contraseña debe tener al menos 6 caracteres"
  console.error('Error:', data?.error);
  return;
}

// Exito
```

#### Registro de usuario nuevo (si aplica)

Si el registro de nuevos usuarios tambien hashea con bcrypt de JS, hay que aplicar el mismo patron. Crear una RPC:

```sql
-- Ejecutar en SQL Editor de Supabase si es necesario:
CREATE OR REPLACE FUNCTION public.register_user_password(
  p_user_id uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF length(p_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  UPDATE public.users
  SET password_hash = crypt(p_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id AND password_hash IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado o ya tiene contraseña');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

### Paso 3: Eliminar dependencia de bcrypt (opcional pero recomendado)

Si despues de los cambios bcrypt ya no se usa en ningun otro lugar:

```bash
npm uninstall bcryptjs
# o
npm uninstall bcrypt
```

Esto previene que alguien vuelva a usarlo por error en el futuro.

---

## Fix para usuarios ya afectados

### Usuario confirmado bloqueado

```sql
-- Resetear contraseña de lordget_yt@hotmail.com
UPDATE public.users
SET password_hash = crypt('Vivaluzu1', gen_salt('bf', 10)),
    updated_at = now()
WHERE email = 'lordget_yt@hotmail.com';

-- Verificar que funciona:
SELECT password_hash = crypt('Vivaluzu1', password_hash) AS ok
FROM public.users WHERE email = 'lordget_yt@hotmail.com';
-- Debe devolver: true
```

### Detectar TODOS los usuarios potencialmente afectados

Los hashes generados por bcrypt de JS y los de pgcrypto son ambos bcrypt validos, pero podemos detectar los que fueron modificados recientemente (despues de que se implemento el cambio de contraseña en SofLIA Learning):

```sql
-- Encontrar usuarios cuyo hash NO es verificable con pgcrypto
-- (requiere conocer o estimar sus contraseñas, asi que es mejor
--  buscar por fecha de modificacion)
SELECT
  username,
  email,
  left(password_hash, 10) AS hash_prefix,
  length(password_hash) AS hash_length,
  updated_at
FROM public.users
WHERE updated_at > '2026-03-01'  -- Ajustar la fecha segun cuando se lanzo el feature
ORDER BY updated_at DESC;
```

Para cada usuario de esa lista, contactarlos para resetear su contraseña manualmente con:

```sql
UPDATE public.users
SET password_hash = crypt('CONTRASEÑA_TEMPORAL', gen_salt('bf', 10)),
    updated_at = now()
WHERE email = 'EMAIL_DEL_USUARIO';
```

---

## Regla para el futuro

> **NUNCA usar bcrypt/bcryptjs de JavaScript para hashear contraseñas que seran verificadas por PostgreSQL pgcrypto.**
>
> Siempre usar funciones RPC que llamen a `crypt()` + `gen_salt()` de pgcrypto directamente en la base de datos.

Esto aplica a:
- Cambio de contraseña
- Reset de contraseña
- Registro de usuarios nuevos
- Cualquier operacion que escriba en `password_hash`

---

## Referencia: Funciones RPC disponibles

| Funcion | Parametros | Uso |
|---------|-----------|-----|
| `authenticate_user` | `p_identifier text, p_password text` | Login (ya existia) |
| `change_user_password` | `p_user_id uuid, p_new_password text` | Cambio por admin/reset |
| `change_own_password` | `p_user_id uuid, p_current_password text, p_new_password text` | Cambio por el propio usuario |
| `register_user_password` | `p_user_id uuid, p_password text` | Registro nuevo (crear si es necesario) |

Todas retornan `jsonb` con formato: `{ "success": true/false, "error": "mensaje si fallo" }`

---

## Checklist de implementacion

- [ ] Buscar todos los usos de `bcrypt.hash()` y `bcrypt.compare()` relacionados con `password_hash` en SofLIA Learning
- [ ] Reemplazar cada uno por la llamada RPC correspondiente (`change_user_password`, `change_own_password`, o `register_user_password`)
- [ ] Verificar que el registro de usuarios nuevos tambien use pgcrypto (via RPC o via `crypt()` en un trigger)
- [ ] Resetear la contraseña de `lordget_yt@hotmail.com` con el SQL de arriba
- [ ] Identificar y resetear otros usuarios afectados
- [ ] Probar el flujo completo: cambiar contraseña en SofLIA Learning → login en SofLIA Hub
- [ ] (Opcional) Desinstalar bcryptjs/bcrypt si ya no se usa
