# Verificación — restore-sofia-main-session

Fecha: 2026-09-04. Rama: `codex/fix-sofia-org-whatsapp-auth`.

## Diagnóstico reproducido

- Evidencia visual: UI con sesión aparente y organización degradada; WhatsApp en línea sin respuesta.
- Evidencia de consola: `42501 permission denied for table users`, seguido de descarte por `sin identidad SOFIA activa con capacidad personal_agent`.
- Causa confirmada en código: `SofiaAuthService.getSession()` fabricaba una sesión sin tokens desde `sofia-session`, mientras `electron/iris/clients.ts` creaba el cliente SOFIA de main sin sesión renovable y `auth:set-state` no publicaba el refresh token SOFIA.
- Hipótesis refutada: las preferencias de última conexión y confirmación de lectura no participan en `messages.upsert`, la allowlist ni la resolución de principal.

## Matriz de casos

| Caso | Evidencia | Resultado |
|---|---|---|
| Sesión SOFIA real en renderer | `sofia-auth-session.test.ts` | Pasa |
| Snapshot local sin JWT | `sofia-auth-session.test.ts` | Pasa; devuelve `null` |
| Publicación IPC con par SOFIA | `auth-state-contract.test.ts` | Pasa; habilita solo identidad coincidente |
| Usuario vacío, payload inválido y par incompleto | `auth-state-contract.test.ts` | Pasa; rechazo sin aplicar credenciales |
| Token de otro usuario | `sofia-session.test.ts` | Pasa; revoca y borra |
| Persistencia/rotación cifrada | `hub-session.test.ts`, `sofia-session.test.ts` | Pasa |
| Sin cifrado o token corrupto | `hub-session.test.ts`, helper compartido | Pasa; no hay texto plano |
| Restauración en frío y revocación | `sofia-session.test.ts` | Pasa |
| Principal por teléfono y membresía activa | `communication-hub-principal-resolution.test.ts` | Pasa |
| Mensaje autorizado entregado al agente | `whatsapp-service.test.ts` (`WA-022`, `WA-042`) | Pasa |
| Número/LID no autorizado | `whatsapp-service.test.ts` | Pasa; conserva deny-by-default |

## Comandos ejecutados

- `npm test -- --run electron/__tests__/hub-session.test.ts electron/__tests__/sofia-session.test.ts electron/__tests__/auth-state-contract.test.ts electron/__tests__/communication-hub-principal-resolution.test.ts electron/__tests__/whatsapp-service.test.ts src/__tests__/services/sofia-auth-session.test.ts` → 6 archivos, 74 pruebas, todas pasan.
- `npm run typecheck` → pasa.
- `npm run lint:changed` → 15 archivos revisados, sin deuda nueva.
- `npm run harness:validate` → pasa; 25 rutas y 9 skills canónicas.
- `npm run docs:check` → pasa; 244 Markdown activos.
- `npm run docs:system:check` → pasa; 28 documentos, 150 IDs, 362 canales y 399 archivos de prueba.
- `npm run openspec:validate` → pasa; 26 cambios válidos.
- `npm run verify:pr` → se ejecutó pero se detuvo en `skills:seed:check`: `database/lia/migrations/system-skills-catalog.sql` ya diverge de `src/shared/skills/registry.ts`. Ninguno fue modificado por este cambio; no se regeneró una migración ajena al alcance.
- `npm run test` → ejecución global interrumpida tras varios minutos sin avance. Antes de quedar en un worker de CPU informó dos fallos de presentaciones ajenos al diff.
- Reejecución focalizada de esos fallos: `PresentationPlayerApp.test.tsx` pasó; `WA-160` siguió fallando porque espera escribir `index.html` pero la implementación actual escribe `deck.json`. Es una divergencia de línea base no relacionada con autenticación ni WhatsApp entrante.

## Revisión adversarial

Hipótesis intentadas:

- Un payload con `userId` vacío o solo un token podía persistir identidad sin asociación: hallazgo corregido exigiendo usuario no vacío y pares completos.
- Un token de otro usuario podía habilitar el gate: refutado con comparación contra `session.user.id` y prueba negativa.
- Los tokens podían aparecer en `auth:get-state`, respuestas o logs: refutado por contrato y pruebas de no filtración; los logs solo contienen estado/código seguro.
- La corrección podía ampliar RLS o instalar `service_role`: refutado; no hay SQL ni claves privilegiadas y el cliente usa la anon key más JWT del usuario.
- La autoconexión podía ejecutarse antes de restaurar identidad: corregido; SOFIA se restaura y fija el gate antes de inicializar servicios, y el listener de login/logout se registra después de la restauración.
- Logout podía dejar una de las dos sesiones: corregido con revocación concurrente de SOFIA, Lia y Project Hub.

## Riesgo residual y validación manual

- No se ejecutó una consulta contra la instancia SOFIA real ni se enviaron mensajes externos. Tras instalar, reiniciar e iniciar sesión una vez, debe comprobarse con una cuenta controlada que la RLS autenticada permite leer la fila propia/membresía y que desaparecen `42501` y el descarte `personal_agent`.
- La compuerta integral permanece roja por la semilla de Skills y el caso `WA-160` preexistentes; resolverlos requiere un cambio separado para no mezclar contratos.
- Rollback local: revertir este cambio y retirar `sofia-session.enc`; no hay migración ni dato remoto que revertir.
