# BUG: Login falla despues de cambiar contraseña en SofLIA Learning

## Resumen del problema

Cuando un usuario cambia su contraseña desde la pagina de cambio de contraseña de **SofLIA Learning**, al intentar iniciar sesion en **SofLIA Hub** (ya sea con usuario o correo) la contraseña nueva es rechazada como "incorrecta".

---

## Causa raiz

La tabla `public.users` en la base de datos compartida (Supabase: **SofLIA-Learning / mrqnnmuckznvukjvfkly**) almacena contraseñas hasheadas con **bcrypt**. La columna `password_hash` tiene un CHECK constraint que valida el formato bcrypt:

```sql
password_hash text CHECK (
  password_hash IS NULL
  OR password_hash ~* '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
)
```

Los hashes existentes en la BD son bcrypt validos (ej: `$2b$10$Ds5Vs2xD6d82...`).

### Como funciona el login en SofLIA Hub

SofLIA Hub llama a la funcion RPC `authenticate_user` en la BD de SOFIA:

```typescript
// src/services/sofia-auth.ts (SofLIA Hub)
const { data: authResult } = await sofiaSupa.rpc('authenticate_user', {
  p_identifier: emailOrUsername,  // usuario o correo
  p_password: password            // contraseña en texto plano
});
```

Esta funcion RPC internamente hace algo como:

```sql
SELECT * FROM users
WHERE (username = p_identifier OR email = p_identifier)
  AND password_hash = crypt(p_password, password_hash);
```

La funcion `crypt(p_password, password_hash)` de **pgcrypto** toma la contraseña en texto plano y la hashea usando el salt embebido en el hash existente. Si el resultado coincide con `password_hash`, la contraseña es correcta.

### Donde esta el bug

El codigo de **cambio de contraseña en SofLIA Learning** esta guardando el nuevo `password_hash` de forma incorrecta. Posibles causas (revisar cual aplica):

| Causa posible | Como detectarla |
|---|---|
| **Se guarda la contraseña en texto plano** | El CHECK constraint de la tabla lo rechazaria (el UPDATE fallaria silenciosamente o con error) |
| **Se hashea con un algoritmo diferente** (sha256, md5, argon2, etc.) | El hash guardado NO empezaria con `$2a$`, `$2b$` o `$2y$` |
| **Se hashea con bcrypt pero desde JavaScript/Node en vez de pgcrypto** | El hash PARECE valido (`$2b$...`) pero puede tener diferencias sutiles en el encoding que hacen que `crypt()` de PostgreSQL no lo reconozca |
| **Se usa una libreria de bcrypt JS que genera hashes incompatibles con pgcrypto** | Mismo sintoma: hash parece bcrypt pero `crypt()` de Postgres no lo valida |

---

## Como diagnosticar

### Paso 1: Verificar la funcion authenticate_user

Ejecutar en el **SQL Editor** de Supabase (proyecto SofLIA-Learning):

```sql
-- Ver la definicion completa de la funcion
SELECT
  p.proname AS nombre,
  pg_get_functiondef(p.oid) AS definicion_completa
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'authenticate_user';
```

Copiar el resultado. Esto muestra exactamente como valida la contraseña.

### Paso 2: Verificar que pgcrypto esta habilitado

```sql
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
```

Si no aparece, habilitarla:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### Paso 3: Probar manualmente que el hash funciona

```sql
-- Tomar un usuario de prueba y verificar que su hash actual es valido
SELECT
  username,
  email,
  password_hash,
  -- Esto deberia devolver TRUE si el hash fue creado correctamente
  (password_hash = crypt('CONTRASEÑA_ACTUAL', password_hash)) AS hash_valido
FROM public.users
WHERE email = 'correo_del_usuario@ejemplo.com';
```

### Paso 4: Simular un cambio correcto y verificar

```sql
-- Generar un hash correcto y comparar con lo que SofLIA Learning guarda
SELECT crypt('nueva_contraseña_test', gen_salt('bf', 10)) AS hash_correcto;
```

Ahora cambiar la contraseña desde SofLIA Learning y comparar el `password_hash` resultante con el formato de arriba.

### Paso 5: Revisar que guarda SofLIA Learning

Despues de cambiar la contraseña desde la pagina, ejecutar:

```sql
SELECT
  username,
  email,
  password_hash,
  updated_at,
  length(password_hash) AS largo_hash
FROM public.users
WHERE email = 'correo_del_usuario@ejemplo.com';
```

Verificar:
- `password_hash` empieza con `$2a$`, `$2b$` o `$2y$` → es bcrypt
- `length(password_hash)` es exactamente **60** caracteres
- `updated_at` se actualizo (confirma que el UPDATE si se ejecuto)

---

## Solucion

### Opcion A: Corregir el codigo de SofLIA Learning (RECOMENDADO)

Buscar en el codigo de SofLIA Learning donde se hace el cambio de contraseña. Sera algo como:

```javascript
// BUSCAR algo asi (el bug):
const hashedPassword = await bcrypt.hash(newPassword, 10);
await supabase
  .from('users')
  .update({ password_hash: hashedPassword })
  .eq('id', userId);
```

El problema con este approach es que **bcrypt de JavaScript** (librerias como `bcryptjs`, `bcrypt`) puede generar hashes que no son 100% compatibles con `crypt()` de PostgreSQL pgcrypto.

**La solucion correcta** es usar una funcion RPC de PostgreSQL que hashee con `crypt()` de pgcrypto directamente:

#### 1. Crear la funcion RPC en Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cambiar contraseña (para admins o pagina de reset)
CREATE OR REPLACE FUNCTION public.change_user_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  v_hash := crypt(p_new_password, gen_salt('bf', 10));

  UPDATE public.users
  SET password_hash = v_hash,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Cambiar contraseña propia (usuario autenticado, requiere contraseña actual)
CREATE OR REPLACE FUNCTION public.change_own_password(
  p_user_id uuid,
  p_current_password text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_hash text;
  v_new_hash text;
BEGIN
  SELECT password_hash INTO v_current_hash
  FROM public.users
  WHERE id = p_user_id;

  IF v_current_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no encontrado');
  END IF;

  IF crypt(p_current_password, v_current_hash) != v_current_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contraseña actual incorrecta');
  END IF;

  IF length(p_new_password) < 6 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'La nueva contraseña debe tener al menos 6 caracteres'
    );
  END IF;

  v_new_hash := crypt(p_new_password, gen_salt('bf', 10));

  UPDATE public.users
  SET password_hash = v_new_hash,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
```

#### 2. Cambiar el codigo de SofLIA Learning

Reemplazar el UPDATE directo por la llamada RPC:

```typescript
// ANTES (bug): hash desde JavaScript
const hashedPassword = await bcrypt.hash(newPassword, 10);
await supabase.from('users').update({ password_hash: hashedPassword }).eq('id', userId);

// DESPUES (correcto): hash desde PostgreSQL via RPC
const { data, error } = await supabase.rpc('change_user_password', {
  p_user_id: userId,
  p_new_password: newPassword
});

if (error || !data?.success) {
  // Manejar error: data?.error contiene el mensaje
  console.error('Error cambiando contraseña:', data?.error || error?.message);
}
```

O si la pagina pide la contraseña actual:

```typescript
const { data, error } = await supabase.rpc('change_own_password', {
  p_user_id: userId,
  p_current_password: currentPassword,
  p_new_password: newPassword
});
```

### Opcion B: Fix temporal para usuarios ya afectados

Si ya hay usuarios que cambiaron su contraseña y no pueden entrar, un admin puede resetearles la contraseña desde el SQL Editor:

```sql
-- Resetear la contraseña de un usuario especifico
UPDATE public.users
SET password_hash = crypt('contraseña_temporal_123', gen_salt('bf', 10)),
    updated_at = now()
WHERE email = 'correo@ejemplo.com';
-- Avisar al usuario que su contraseña temporal es: contraseña_temporal_123
```

---

## Problema secundario: Cache de credenciales en SofLIA Hub

SofLIA Hub cachea las credenciales de Lia (Supabase secundario) en `localStorage` bajo la key `lia-sync-cred` con el formato `{ e: email, p: password }`. Despues de un cambio de contraseña:

1. El cache tiene la contraseña vieja
2. Al reiniciar la app, intenta re-autenticar con Lia usando la contraseña vieja
3. Falla y muestra "Lia degradado"

**Esto NO causa el error principal** (el login de SOFIA falla antes de llegar a Lia), pero si causa problemas de sincronizacion despues. Se resuelve automaticamente cuando el usuario cierra sesion y vuelve a entrar con la nueva contraseña — en ese momento se sobreescriben las credenciales cacheadas.

---

## Resumen de acciones

| # | Accion | Donde | Prioridad |
|---|---|---|---|
| 1 | Ejecutar las funciones RPC `change_user_password` y `change_own_password` | SQL Editor de Supabase (SofLIA-Learning) | **Alta** |
| 2 | Modificar el codigo de cambio de contraseña para usar `supabase.rpc('change_user_password', ...)` en vez de UPDATE directo | Codigo de SofLIA Learning | **Alta** |
| 3 | Resetear contraseñas de usuarios afectados con `crypt()` desde SQL | SQL Editor de Supabase | **Media** (solo si hay usuarios bloqueados) |
| 4 | (Opcional) Verificar la definicion de `authenticate_user` con la query del Paso 1 | SQL Editor de Supabase | Baja (para confirmar diagnostico) |

---

## Archivos relevantes en SofLIA Hub (para referencia)

| Archivo | Que hace |
|---|---|
| `src/services/sofia-auth.ts` | Llama a `authenticate_user` RPC para login |
| `src/contexts/AuthContext.tsx` | Maneja sesion, cachea credenciales de Lia en localStorage |
| `electron/iris-data-main.ts` | Tambien usa `authenticate_user` para auth de WhatsApp |
| `src/lib/sofia-client.ts` | Cliente Supabase de SOFIA |
