# Funciones Supabase de Lia

## `sofia-session-exchange`

Intercambia una sesión válida de SOFIA por un token Lia de un solo uso. La función se despliega en el proyecto Lia y valida manualmente el JWT externo contra SOFIA; por eso `config.toml` declara `verify_jwt = false`.

Secretos requeridos, sin versionar valores:

- `SOFIA_SUPABASE_URL`
- `SOFIA_SUPABASE_ANON_KEY`

El entorno de la función también debe proporcionar la URL y clave administrativa del proyecto Lia (`SUPABASE_URL` y una de las variantes oficiales de clave secreta/service role). Nunca copiar esa clave al renderer ni a variables `VITE_*`.

Antes de desplegar:

1. Vincular el CLI con el proyecto Lia desde este directorio.
2. Cargar los dos secretos SOFIA en el gestor de secretos del proyecto.
3. Desplegar `sofia-session-exchange` respetando `verify_jwt = false`.
4. Probar token ausente, token inválido, membresía inactiva, cuenta Lia existente y alta autorizada nueva.
5. Confirmar que los logs no incluyen bearer tokens, correos, enlaces ni `tokenHash`.

El backend debe publicarse y validarse antes que el cliente. Para revertir, se vuelve a la versión anterior del cliente y se deshabilita la función; no existe migración SQL que deshacer.
