# Conversaciones no disponibles después del login

Estado: implementación local; despliegue pendiente. Actualizado: 2026-08-04.

<!-- evidence: src/services/lia-session-exchange.ts -->
<!-- evidence: src/contexts/auth/useLiaSession.ts -->
<!-- evidence: database/lia/supabase/functions/sofia-session-exchange/index.ts -->
<!-- evidence: openspec/changes/federate-sofia-lia-session -->

## Causa corregida

El diseño anterior autenticaba SOFIA y después reutilizaba la contraseña escrita para abrir una cuenta Auth separada en Lia. Cambiar la contraseña en SofLIA Learning modificaba solo SOFIA; la cuenta operativa podía conservar otro valor y bloquear las conversaciones aunque el login principal fuera correcto.

Los intentos SOFIA incorrectos no llegaban a Lia porque el flujo se detenía antes. El fallo aparecía al tercer intento correcto por la divergencia previa entre dos autoridades de contraseña, no porque esos dos intentos hubieran bloqueado el chat.

## Solución estructural

SOFIA es la única autenticación visible. Después de validar el login y la membresía, el cliente envía el JWT SOFIA vigente a `sofia-session-exchange`. La función:

1. verifica el bearer token y el correo confirmado directamente contra SOFIA;
2. comprueba una membresía activa del mismo sujeto;
3. obtiene el correo únicamente de la identidad verificada;
4. genera en Lia un token de un solo uso para ese correo;
5. devuelve solo `tokenHash` y evita caché.

El cliente canjea el hash inmediatamente y recibe una sesión Lia ordinaria. Una cuenta Lia existente conserva su UUID y, por tanto, la propiedad/RLS de sus conversaciones. Si falta, `generateLink` crea el usuario de forma idempotente sin compartir una contraseña.

La aplicación ya no llama `signInWithPassword`, `signUp` ni `updateUser` de Lia durante el login SOFIA, no solicita una contraseña anterior y no expone nombres internos en la UI.

## Estado visible

Ante una indisponibilidad, SOFIA permanece activa y solo se bloquean las funciones que necesitan conversaciones. La UI muestra:

> No pudimos cargar tus conversaciones. Tu sesión sigue activa. Comprueba tu conexión e intenta nuevamente.

`Reintentar` repite restauración/intercambio sin solicitar otra contraseña. Los detalles técnicos pertenecen a diagnóstico de soporte, no a la interfaz final.

## Despliegue seguro

La función vive en `database/lia/supabase/` y debe desplegarse antes del cliente.

- Configurar `SOFIA_SUPABASE_URL` y `SOFIA_SUPABASE_ANON_KEY` como secretos de la función, sin versionar valores.
- Mantener la clave administrativa Lia únicamente en el entorno backend.
- Respetar `verify_jwt = false`: el gateway Lia no puede validar un JWT emitido por SOFIA; el handler lo valida explícitamente contra SOFIA antes de tocar Lia.
- Probar token ausente/inválido, membresía inactiva, cuenta existente, cuenta nueva autorizada y fallo transitorio.
- Reconciliar en las cuentas piloto que cada correo pertenezca a la misma persona en SOFIA y Lia antes de habilitar el cliente.
- Confirmar que logs/telemetría no contienen correo, JWT, contraseña, enlace mágico ni `tokenHash`.

No se ejecutó despliegue remoto ni se modificaron secretos durante la implementación local. Publicar función, cargar secretos y liberar cliente requieren HITL.

## Diagnóstico para soporte

| Resultado backend | Interpretación | Acción |
|---|---|---|
| `401 not_authenticated` | sesión SOFIA ausente, inválida o vencida | revisar restauración/refresh de SOFIA; no tocar contraseñas Lia |
| `403 access_denied` | identidad válida sin membresía activa o política la niega | revisar membresía SOFIA del usuario |
| `503 exchange_unavailable` | configuración o dependencia temporalmente indisponible | revisar secretos, función, SOFIA/Lia y reintentar |
| `200` pero falla `verifyOtp` | token vencido/consumido o Auth Lia indisponible | reintentar intercambio y revisar límites Auth |

Rollback: volver al cliente anterior y deshabilitar la función. No existe migración SQL ni cambio de UUID que revertir. El comportamiento de doble contraseña anterior no debe restaurarse como solución permanente.
