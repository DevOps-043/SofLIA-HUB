# SofLIA Hub — Notificaciones por WhatsApp y Telegram

**Estado:** Especificación técnica (documentación). No incluye cambios de código.
**Audiencia:** ingeniería de plataforma (SofLIA Learning), equipo/agente que construya el servicio "SofLIA Hub" para VPS de cliente.
**Relacionado:** `CLAUDE.md` (arquitectura general), `README.md` (variables `SOFLIA_HUB_*` ya documentadas).

---

## 1. Resumen ejecutivo

SofLIA Learning ya tiene un **sistema de notificaciones in-app completo** (tablas, RLS, preferencias por usuario, configuración por organización) y un **borrador parcial** de entrega externa por WhatsApp: una tabla de cola (`notification_channel_deliveries`) y un cron de Netlify (`process-notification-deliveries.ts`) que reenvía cada entrega pendiente a una URL externa llamada "SofLIA Hub" mediante POST firmado con HMAC.

Lo que falta para cumplir la premisa del negocio — *"cada organización despliega su propio SofLIA Hub en su VPS, y SofLIA les manda a sus empleados, por WhatsApp o Telegram, las notificaciones que ya genera el sistema (ej. recordatorios de avanzar el curso)"* — es:

1. **Multi-tenencia real de configuración de Hub.** Hoy el cron usa **una sola** URL/API-key global (`SOFLIA_HUB_NOTIFICATIONS_URL` / `SOFLIA_HUB_API_KEY`) para *toda* la plataforma. El modelo de negocio requiere que **cada organización tenga su propia URL de Hub, su propia API key, y sus propias credenciales de WhatsApp/Telegram**, ya que cada una corre su propia instancia en su propia VPS con su propia cuenta de WhatsApp Business y su propio bot de Telegram.
2. **Canal Telegram**, que no existe en absoluto hoy (ni en el esquema de BD, ni en el código).
3. **Vinculación de identidad (opt-in) verificada** — hoy el sistema confía ciegamente en `users.phone`/`users.country_code`, campos sin validación de formato y sin verificación de que el usuario realmente controla ese número. Para WhatsApp esto además choca con una regla de cumplimiento de Meta (ver §6.3).
4. **Especificación completa del servicio SofLIA Hub** (el software que corre en la VPS del cliente): qué expone, qué consume, cómo se autentica, cómo maneja WhatsApp/Telegram, y cómo reporta estado de vuelta a la plataforma central.

Este documento cubre: (A) el sistema de notificaciones actual tal como existe hoy, con nombres exactos de archivos/tablas/columnas; (B) el diagnóstico de brechas; (C) el diseño propuesto multi-tenant de SofLIA Hub, con contrato de API, modelo de datos nuevo, flujo de vinculación, y consideraciones de seguridad/cumplimiento; (D) un plan de implementación por fases.

---

## 2. Sistema de notificaciones actual (estado real de la plataforma)

### 2.1 Modelo de datos

**`public.user_notifications`** — una fila por notificación por usuario.

| Columna | Tipo | Notas |
|---|---|---|
| `notification_id` | uuid PK | |
| `user_id` | uuid FK → `users(id)` | |
| `notification_type` | varchar | ver catálogo §2.2 |
| `title`, `message` | varchar / text | frecuentemente **claves i18n**, no texto plano (ver `isLocalized` en metadata) |
| `metadata` | jsonb | `action_url`, `course_id`, etc. — específico por tipo |
| `priority` | varchar | `critical \| high \| medium \| low` |
| `status` | varchar | `unread \| read \| archived` |
| `channels_sent` | jsonb (array) | canales ya entregados, ej. `['in_app']` |
| `channels_pending` | jsonb (array) | canales externos aún no entregados, ej. `['whatsapp']` |
| `dedup_key` | text | único junto a `(user_id, notification_type)` cuando no es null — evita duplicados |
| `read_at`, `expires_at` | timestamptz | |
| `organization_id`, `group_id` | uuid | |
| `created_at`, `updated_at` | timestamptz | |

Índices relevantes: `idx_user_notifications_dedup_key` (único, parcial), `idx_user_notifications_status_created`, `idx_user_notifications_unread_priority_expires_at`.

RLS (`20260521100000_rls_direct_user_activity_phase1.sql`): `authenticated` puede `SELECT`/`UPDATE` (solo columnas `status,read_at,updated_at`)/`DELETE` de sus propias filas, o leer las de su organización si es admin (`can_read_org_user_activity`). `service_role` tiene acceso total. Las mutaciones de estado pasan por RPCs `security definer`: `mark_notification_read`, `archive_notification`, `delete_notification`, `mark_all_notifications_read` (migración `20260625090000_notifications_v1_channels_and_actions.sql`).

**`public.user_notification_preferences`** — una fila por `(user_id, notification_type)`.

| Columna | Notas |
|---|---|
| `in_app_enabled`, `push_enabled`, `email_enabled`, `whatsapp_enabled` | booleanos por canal |
| `email_frequency` | `immediate \| daily \| weekly \| never` |
| `do_not_disturb_start/end/days`, `timezone` | ventana de silencio |

`whatsapp_enabled` fue agregado en la migración v1; **no existe `telegram_enabled`**. RLS: estrictamente propio (`user_id = auth.uid()`).

**`public.notification_channel_deliveries`** — cola de entrega externa (migración `20260625090000`).

```sql
CREATE TABLE public.notification_channel_deliveries (
  delivery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES user_notifications(notification_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email','push','sms','whatsapp')),  -- ⚠ sin 'telegram'
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  destination text,               -- número E.164 (whatsapp) — sin validar
  payload jsonb NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_channel_deliveries_unique_channel UNIQUE (notification_id, channel)
);
```

RLS: **solo `service_role`** — invisible para clientes autenticados; únicamente el backend con service-role key puede leer/escribir. Esto es correcto para una cola de trabajo, pero implica que hoy **no hay ninguna UI** (ni de negocio ni de admin) que muestre el estado de las entregas externas.

**Tablas legacy encontradas en el dump de esquema, no usadas por el pipeline actual** (candidatas a deprecar o reutilizar con cuidado): `notification_email_queue`, `notification_push_subscriptions`, `notification_stats`, `organization_notification_preferences` (duplicado casi idéntico de `notification_settings`, sin código que lo referencie).

**`notification_settings`** (por organización, sí está en uso — ver §2.4): `organization_id, event_type, enabled, channels jsonb default '["email"]', template`.

### 2.2 Catálogo de tipos y categorías

`apps/web/src/features/notifications/utils/notification-categories.*.ts` define **9 categorías visuales** (`system, community, course, news, reel, prompt, critical, org, planner`) cada una con color/icono/prioridad por defecto, y un mapa de ~34 `notification_type` concretos a categoría (`notification-categories.map.ts`).

`apps/web/src/features/notifications/services/notification/catalog.ts` define el catálogo "real":

```ts
NOTIFICATION_CHANNELS = ['in_app', 'email', 'push', 'sms', 'whatsapp']
EXTERNAL_NOTIFICATION_CHANNELS = ['email', 'push', 'sms', 'whatsapp']

NOTIFICATION_EVENT_CHANNEL_DEFAULTS = {
  certificate_generated:  ['in_app', 'whatsapp'],
  course_completed:       ['in_app'],
  learning_daily_summary: ['in_app', 'whatsapp'],   // ← "avanza tu curso"
  system_login_failed:    ['in_app'],
  system_login_unusual:   ['in_app'],
  system_security_alert:  ['in_app', 'whatsapp'],
}
```

**Solo estos seis tipos** tienen un canal externo configurado por defecto hoy; el resto de los ~34 tipos son in-app únicamente hasta que se extienda esta tabla.

⚠️ **Catálogo duplicado e inconsistente:** `notification-settings.catalog.ts` (usado por la configuración de organización, §2.4) define otro conjunto de 7 "event types" de negocio (`course_assigned, course_completed, certificate_generated, deadline_approaching, learning_daily_summary, progress_milestone, user_added`) que **no coincide 1:1** con los `notification_type` reales que crea el sistema (ej. `course_enrolled`, `course_deadline_approaching`, `mandatory_course_reminder` no aparecen en ese catálogo). El gating de WhatsApp por organización (`isWhatsappAllowedForOrganization`) hace un match exacto de string contra `notification_settings.event_type` — si los nombres no coinciden, el toggle de organización simplemente no aplica silenciosamente. **Esto debe reconciliarse antes de construir Telegram sobre el mismo mecanismo.**

### 2.3 Flujo de creación y despacho

`apps/web/src/features/notifications/services/notification/creation.service.ts` → `createNotification(params)`:

1. Valida campos requeridos.
2. Si `dedupKey` coincide con una fila existente `(user_id, notification_type, dedup_key)`, retorna la existente sin duplicar.
3. Ventana de supresión de duplicados por tipo (`NON_DUPLICATE_NOTIFICATION_TYPES`, ej. `certificate_generated: 1440min`).
4. Inserta en `user_notifications`. **Aquí se decide `channels_pending`**: `normalizeNotificationChannels(params.channels ?? getDefaultNotificationChannels(type))`, filtrando los canales externos (`channels_pending`) de los internos (`channels_sent = ['in_app']`).
5. Llama a `enqueueNotificationChannelDeliveries(...)` — hoy **solo maneja `whatsapp`**. Antes de encolar valida tres condiciones (todas deben cumplirse):
   - Teléfono normalizable (`users.phone` + `users.country_code` → `+<code><digits>`, sin validación real de E.164).
   - `user_notification_preferences.whatsapp_enabled = true` para ese `(user, notification_type)`.
   - Plan de la organización habilita `notification_whatsapp` (`hasFeature`) **y** `notification_settings` de la org permite ese `event_type`/canal.
6. Si pasa, hace `upsert` en `notification_channel_deliveries` con `status='pending'`.

**Caso especial — "avanza tu curso" (`learning_daily_summary`):** no pasa por este flujo. Es generado por un **cron independiente**, `netlify/functions/process-learning-reminders.ts` (horario, `0 * * * *`), que:
- Recorre `user_course_enrollments` incompletas.
- Calcula la hora local del usuario vía `user_notification_preferences.timezone` y solo actúa si coincide con `LEARNING_REMINDERS_LOCAL_HOUR` (default 9am).
- Usa `dedup_key = user_id:fecha_local` (un recordatorio por día por usuario).
- **Duplica** (código propio, no reutiliza `delivery-queue.service.ts`) la misma lógica de normalización de teléfono y de gating por plan (`isWhatsappPlan`: `business`/`enterprise`), porque es una Netlify Function separada que no puede importar el árbol de módulos server-only de Next.js.

Esta duplicación de lógica (creation.service.ts vs. process-learning-reminders.ts) es un problema de mantenibilidad real: **cualquier regla nueva de canal/gating debe actualizarse en dos lugares** hasta que se extraiga a un módulo compartido.

### 2.4 Preferencias de usuario y configuración de organización

- **Por usuario:** `user_notification_preferences` (§2.1), editable — presumiblemente — desde `features/profile/` (no se auditó la UI de preferencias en detalle en este documento).
- **Por organización:** `GET/PUT /api/[orgSlug]/business/notifications/settings` (`apps/web/src/app/api/[orgSlug]/business/notifications/settings/route.ts`). Un admin de negocio puede habilitar/deshabilitar cada uno de los 7 `event_type` del catálogo de negocio y elegir canales, pero **solo entre los canales que el plan de suscripción desbloquea**:

  ```ts
  // apps/web/src/lib/subscription/subscriptionFeatures.ts
  notification_email    → todos los planes
  notification_push     → Business+
  notification_sms      → Enterprise
  notification_whatsapp → Business+ (Business y Enterprise)
  ```

  No existe hoy un feature `notification_telegram`.

### 2.5 UI in-app

`NotificationBell` (`core/components/NotificationBell/`) y la página `/dashboard/notifications` comparten el mismo hook/servicio de datos (`useNotifications`, `notification/query-*.service.ts`) y las mismas acciones de mutación (RPCs de §2.1). El canal in-app tiene ciclo de vida completo (leído/archivado/eliminado). **Los canales externos son "fire and record status"**: no hay ninguna UI, ni para el usuario final ni para el admin de negocio, que muestre si un WhatsApp se envió, falló, o sigue pendiente — solo es consultable directamente en la base de datos.

### 2.6 Backend Express (`apps/api`)

Confirmado como **no integrado al pipeline**: expone rutas de lectura/mutación de notificaciones pero no expone creación (`POST`), su `NotificationService` es una reimplementación reducida que siempre inserta `channels_sent`/`channels_pending` como arrays vacíos, no conoce `dedup_key`, y no escribe nunca en `notification_channel_deliveries`. **No debe extenderse** para WhatsApp/Telegram — toda la lógica vive en `apps/web` (Next.js) y en las Netlify Functions.

---

## 3. Pipeline de entrega externa ya existente (scaffold de WhatsApp)

### 3.1 Cron `process-notification-deliveries.ts` (cada 5 min, `netlify.toml`)

- Se auto-desactiva si `SOFLIA_HUB_WHATSAPP_ENABLED !== 'true'`.
- Recupera entregas `processing` atascadas hace más de `NOTIFICATION_DELIVERY_PROCESSING_STALE_MINUTES` (default 15) devolviéndolas a `failed`.
- Toma hasta `NOTIFICATION_DELIVERY_BATCH_SIZE` (default 50) filas `channel='whatsapp' AND status IN ('pending','failed') AND next_attempt_at <= now()`.
- Reclama cada fila con un `UPDATE ... WHERE status IN ('pending','failed')` (lock optimista contra ejecuciones concurrentes).
- POST a `SOFLIA_HUB_NOTIFICATIONS_URL`:

  ```http
  POST {SOFLIA_HUB_NOTIFICATIONS_URL}
  Authorization: Bearer {SOFLIA_HUB_API_KEY}
  X-Soflia-Signature: sha256=<hmac_sha256(body, SOFLIA_HUB_API_KEY)>
  Content-Type: application/json

  {
    "channel": "whatsapp",
    "deliveryId": "uuid",
    "destination": "+52155...",
    "notificationId": "uuid",
    "payload": { "title": "...", "message": "...", "actionUrl": "...", "metadata": {...} },
    "userId": "uuid"
  }
  ```
  Timeout `SOFLIA_HUB_TIMEOUT_MS` (default 8000ms) vía `AbortController`. Espera `{ messageId?: string }` en la respuesta.
- Éxito → `status='sent'`, `sent_at`, `provider_message_id`, y mueve `'whatsapp'` de `channels_pending` a `channels_sent` en `user_notifications`.
- Falla → `status='failed'`, backoff exponencial `min(60, 2^attempts)` minutos; al agotar `max_attempts` (5), `next_attempt_at` se fija en el año 9999 (aparcado permanentemente, no se borra).

### 3.2 Variables de entorno actuales (documentadas en `README.md`)

```bash
SOFLIA_HUB_NOTIFICATIONS_URL=
SOFLIA_HUB_API_KEY=
SOFLIA_HUB_TIMEOUT_MS=8000
SOFLIA_HUB_WHATSAPP_ENABLED=false
LEARNING_REMINDERS_BATCH_SIZE=500
LEARNING_REMINDERS_LOCAL_HOUR=9
NOTIFICATION_DELIVERY_BATCH_SIZE=50
NOTIFICATION_DELIVERY_PROCESSING_STALE_MINUTES=15
```

**Esto es de un solo Hub global.** No hay forma hoy de que dos organizaciones distintas apunten a dos VPS distintas con dos credenciales distintas.

---

## 4. Diagnóstico — brechas frente al objetivo de negocio

| # | Brecha | Impacto | Severidad |
|---|---|---|---|
| 1 | Config de Hub es **global** (un solo `SOFLIA_HUB_NOTIFICATIONS_URL`/`API_KEY` para toda la plataforma), pero el negocio requiere **un Hub por organización** en su propia VPS. | Bloqueante — no se puede lanzar el modelo de negocio sin resolver esto primero. | Crítica |
| 2 | No existe canal `telegram` (ni en el `CHECK` de BD, ni en preferencias, ni en el cron). | Falta la mitad del alcance pedido. | Alta |
| 3 | `users.phone`/`country_code` no tienen validación de formato ni verificación de propiedad — cualquier texto se intenta "normalizar" y usar como destino de WhatsApp. | Mensajes fallidos silenciosamente, posible envío a número equivocado. | Alta |
| 4 | Cumplimiento de WhatsApp Business Platform: los mensajes *iniciados por el negocio* fuera de una ventana de 24h de conversación activa **requieren plantillas pre-aprobadas por Meta**. Casi el 100% de "avanza tu curso" caerá en este caso. No hay ningún flujo de aprobación de plantillas documentado ni un paso de opt-in explícito del usuario. | Riesgo de bloqueo/ban de la cuenta de WhatsApp Business del cliente si se envía sin plantilla aprobada o sin opt-in. | Crítica (legal/cumplimiento) |
| 5 | Lógica de gating (teléfono, preferencia, plan) está **duplicada** entre `delivery-queue.service.ts` y `process-learning-reminders.ts`. | Cualquier regla nueva debe mantenerse en dos lugares; alto riesgo de divergencia. | Media |
| 6 | Catálogo de `event_type` de `notification_settings` (config de organización) no coincide con los `notification_type` reales creados por el sistema. | El toggle de canal por organización puede no aplicar sin que nadie lo note. | Media |
| 7 | Ninguna UI (usuario ni admin) muestra estado de entrega externa (`sent`/`failed`/`pending`). | Soporte no puede diagnosticar "no me llegó el WhatsApp" sin acceso a BD. | Media |
| 8 | El servicio "SofLIA Hub" en sí **no existe como código** — solo el lado emisor (plataforma → Hub) está implementado. | Sin este documento y sin implementación, no hay receptor real. | Bloqueante |
| 9 | Riesgo de **SSRF**: si un admin de organización puede configurar libremente la URL de su propio Hub, la plataforma central terminará haciendo peticiones HTTP salientes a una URL arbitraria suministrada por un tercero (el cliente). | Un admin malicioso o comprometido podría apuntar la URL a infraestructura interna de SofLIA (`http://169.254.169.254/...`, IPs privadas, `localhost`). | Alta (seguridad) |
| 10 | Tablas legacy (`notification_email_queue`, `organization_notification_preferences`) sin código que las use — confusión para quien lea el esquema. | Deuda técnica, no bloqueante. | Baja |

---

## 5. Requisitos del nuevo modelo (multi-tenant por organización)

1. Cada organización con el feature habilitado (plan Business/Enterprise, igual que hoy) configura, desde su panel de negocio, la URL base de su Hub y recibe/rota una API key emitida por la plataforma (no elegida por el cliente) para autenticar las llamadas **Hub → Plataforma**.
2. La plataforma central **nunca** almacena ni conoce las credenciales de WhatsApp Business ni el token del bot de Telegram — esas viven únicamente en la VPS del cliente, dentro del propio Hub. Esto limita el radio de exposición si la base de datos central es comprometida (principio de mínimo privilegio).
3. El enrutamiento de entregas (`notification_channel_deliveries`) debe resolverse por `organization_id` de la fila, no por variable de entorno global.
4. Debe soportarse WhatsApp y Telegram como canales independientes y activables por separado, cada uno con su propia preferencia de usuario y su propio consentimiento (opt-in) explícito.
5. El opt-in debe doblar como verificación de identidad: el usuario debe demostrar control del número de WhatsApp o del chat de Telegram antes de que se le envíen notificaciones — no basta con el campo `phone` del perfil.
6. Toda comunicación Plataforma↔Hub va firmada (HMAC) y con expiración de timestamp para evitar replay; toda URL de Hub configurada por un cliente se valida contra SSRF antes de usarse.

---

## 6. Arquitectura propuesta

### 6.1 Modelo de despliegue

```
┌─────────────────────────────┐        HTTPS (saliente, firmado HMAC)        ┌──────────────────────────────┐
│   SofLIA Learning (SaaS)    │ ───────────────────────────────────────────▶ │   SofLIA Hub — VPS del Org A  │
│  apps/web + Netlify Functions│                                              │  (Node.js, self-hosted)       │
│                              │ ◀─────────────────────────────────────────── │  - Adaptador WhatsApp Cloud   │
│  notification_channel_       │      HTTPS callback de estado (firmado)      │  - Adaptador Telegram Bot API │
│  deliveries (cola, RLS       │                                              │  - Credenciales del Org A     │
│  service_role)               │                                              │    (viven solo aquí)          │
└─────────────────────────────┘                                              └──────────────────────────────┘
                                                                               ┌──────────────────────────────┐
                                                                               │   SofLIA Hub — VPS del Org B  │
                                                                               │   (instancia independiente)   │
                                                                               └──────────────────────────────┘
```

Un Hub por organización. La plataforma central mantiene un **registro** (`organization_notification_hub_configs`, §7) con la URL y el estado de salud de cada Hub, y enruta cada entrega según el `organization_id` de la fila en `notification_channel_deliveries`.

### 6.2 Flujo end-to-end (ej. recordatorio "avanza tu curso")

1. `process-learning-reminders.ts` (o, mejor, la ruta unificada de creación tras la refactorización de §8) crea la notificación in-app y encola en `notification_channel_deliveries` una fila por canal habilitado por el usuario (`whatsapp`, `telegram`), con `organization_id` poblado.
2. `process-notification-deliveries.ts` (modificado) agrupa las entregas pendientes por `organization_id`, resuelve la config de Hub de esa organización (`organization_notification_hub_configs`), y por cada Hub activo hace el POST firmado (mismo contrato de §3.1, generalizado a `channel: 'whatsapp' | 'telegram'`).
3. El Hub de esa organización recibe la petición, valida la firma HMAC con **su propia** API key emitida por la plataforma, resuelve las credenciales locales del canal correspondiente, y envía el mensaje real vía WhatsApp Cloud API o Telegram Bot API.
4. El Hub responde síncronamente con `202 Accepted` + `messageId` (igual que hoy), y opcionalmente hace un callback posterior (`POST /api/soflia-hub/deliveries/{deliveryId}/status`) si el estado cambia de forma asíncrona (ej. WhatsApp reporta "delivered"/"read" vía su propio webhook al Hub, y el Hub lo traduce a un callback simple hacia la plataforma).
5. La plataforma actualiza `notification_channel_deliveries.status` y sincroniza `channels_sent`/`channels_pending` en `user_notifications`, igual que el mecanismo actual.

### 6.3 Proveedor de WhatsApp — decisión de arquitectura

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **WhatsApp Cloud API (oficial, Meta)** — recomendado | El Hub llama a la API HTTPS oficial de Meta con un token de acceso de larga duración del Business Account del cliente. No requiere sesión persistente ni QR. | Soportado por Meta, sin riesgo de ban, permite plantillas aprobadas, escalable, no necesita mantener un socket vivo. | El cliente debe tener una cuenta de WhatsApp Business API verificada (proceso de Meta, puede tomar días); tiene costo por conversación. |
| Librerías no oficiales (ej. multi-device web) | Emulan el cliente web de WhatsApp con una sesión QR persistente en la VPS. | "Gratis", no requiere aprobación de Meta. | Viola los Términos de Servicio de WhatsApp; riesgo real y frecuente de **baneo del número** sin aviso; sin soporte; no permite operar de forma confiable para una plataforma B2B con SLA. **No se recomienda para un producto empresarial.** |

**Recomendación:** usar exclusivamente **WhatsApp Cloud API** dentro del Hub, y documentar como requisito de onboarding que cada organización debe tener (o crear) su propia cuenta de WhatsApp Business verificada. Aunque la VPS ya no es estrictamente necesaria para hablar con la Cloud API (es solo HTTPS saliente), **se mantiene el modelo self-hosted** porque es el pedido explícito del negocio (aislar credenciales por organización, no centralizarlas en el SaaS) y porque facilita añadir Telegram (que sí se beneficia de tener un proceso persistente para recibir updates).

**Cumplimiento crítico:** WhatsApp exige que los mensajes iniciados por el negocio fuera de la ventana de 24 h desde el último mensaje del usuario usen **plantillas de mensaje pre-aprobadas** por Meta (categoría *Utility* para recordatorios transaccionales como "avanza tu curso"). Esto implica:
- Cada organización debe registrar y esperar aprobación de al menos una plantilla (ej. `curso_recordatorio_diario`) antes de poder activar WhatsApp.
- El `payload` que la plataforma envía al Hub debe incluir las variables de la plantilla (nombre, curso, progreso, URL), no texto libre, cuando se envía fuera de la ventana de 24h.
- El flujo de opt-in (§6.5) es también el mecanismo que abre la ventana de 24h la primera vez y dispara la construcción del historial de conversación.

### 6.4 Proveedor de Telegram

Telegram Bot API es simple y sin restricciones de plantillas: cada organización crea su propio bot vía **BotFather**, obtiene un `bot_token`, y lo configura únicamente en su Hub (nunca en la plataforma central). El Hub puede operar en modo *webhook* (Telegram le hace POST al Hub cuando llega un mensaje) o *long polling* — para una VPS simple, *webhook* con TLS es preferible.

### 6.5 Vinculación de identidad (opt-in) — reemplaza la confianza ciega en `users.phone`

Se propone una nueva tabla `user_notification_channel_links` (§7) y un flujo de vinculación explícito por canal, iniciado desde el perfil del usuario en SofLIA (`features/profile/`):

**Telegram:**
1. Usuario hace clic en "Conectar Telegram" en su perfil → la plataforma genera un `linking_token` de un solo uso (TTL 10 min) y construye `https://t.me/<bot_username_de_su_org>?start=<linking_token>`.
2. Usuario abre el enlace, Telegram abre el chat con el bot de su organización, y el cliente de Telegram envía automáticamente `/start <linking_token>`.
3. El Hub (que atiende el webhook del bot) recibe el mensaje, extrae el token, y llama a un endpoint REST de la plataforma (`POST /api/soflia-hub/links/telegram`, firmado) con `{ linkingToken, chatId }`.
4. La plataforma valida el token (no expirado, no usado), resuelve el `user_id` asociado, guarda `chat_id` en `user_notification_channel_links`, marca `telegram_enabled = true` en preferencias, y responde éxito. El Hub envía un mensaje de confirmación al usuario por Telegram.

**WhatsApp:** mismo patrón usando un enlace `wa.me/<numero_negocio>?text=<linking_token>` — el usuario envía el mensaje pre-rellenado con el token al número de WhatsApp Business de su organización; esto simultáneamente **verifica que el usuario controla ese número** y **abre la ventana de 24h / registra el opt-in exigido por Meta**, resolviendo la brecha #3 y parte de la #4 del diagnóstico.

Este flujo reemplaza la lectura directa de `users.phone` como fuente de verdad del destino — `users.phone` deja de usarse para enrutar mensajes; solo se usa como sugerencia/prellenado en la UI de vinculación.

### 6.6 Contrato de API Plataforma ↔ Hub (extendido)

**Plataforma → Hub** (igual base que hoy, generalizado):

```http
POST {hub_base_url}/notifications
Authorization: Bearer {hub_api_key}
X-Soflia-Signature: sha256=<hmac>
X-Soflia-Timestamp: <unix_ts>       # nuevo — mitiga replay junto con una ventana de tolerancia (ej. 5 min)

{
  "channel": "whatsapp" | "telegram",
  "deliveryId": "uuid",
  "destination": { "kind": "phone_e164", "value": "+52..." }   // whatsapp
                | { "kind": "telegram_chat_id", "value": "123456789" },  // telegram
  "template": { "name": "curso_recordatorio_diario", "variables": {...} } | null,  // requerido si whatsapp fuera de ventana 24h
  "notificationId": "uuid",
  "payload": { "title": "...", "message": "...", "actionUrl": "..." },
  "userId": "uuid"
}
```
Respuesta esperada: `202 { "accepted": true, "messageId"?: string }` o `4xx/5xx` con `{ "error": "..." }` (sin reintento automático de parte del Hub — el backoff lo controla la plataforma, igual que hoy).

**Hub → Plataforma** (nuevo, opcional — para estados asíncronos tipo "delivered"/"read", y para vinculación):

```http
POST /api/soflia-hub/deliveries/{deliveryId}/status
POST /api/soflia-hub/links/telegram
POST /api/soflia-hub/links/whatsapp
Authorization: Bearer {hub_api_key}
X-Soflia-Signature: sha256=<hmac>
```
La plataforma valida la firma usando la API key **de esa organización específica** (resuelta por el `deliveryId`/`linkingToken` incluido, no por IP), y solo acepta si el Hub emisor coincide con el Hub configurado para esa organización.

### 6.7 Seguridad

- **HMAC bidireccional** con secretos independientes por organización (ya existe el patrón; se generaliza).
- **Anti-replay:** timestamp firmado + ventana de tolerancia + rechazo de firmas repetidas (nonce/deliveryId ya es único).
- **Mitigación de SSRF (brecha #9):** al guardar/actualizar la URL de un Hub, la plataforma debe resolver el hostname y rechazar IPs privadas/loopback/metadata (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`), exigir HTTPS, no seguir redirecciones automáticamente en el `fetch` saliente, y repetir la validación de IP en cada llamada (no solo al guardar) para evitar TOCTOU vía DNS rebinding.
- **Credenciales del canal (WhatsApp/Telegram) nunca salen de la VPS del cliente.** La plataforma central solo conoce `hub_base_url` y una API key opaca que ella misma emitió.
- **Rotación de API key** por organización, disparable desde el panel de negocio (invalidando la anterior).
- **Rate limiting** en el endpoint `POST /notifications` del lado del Hub (para protegerse de un bug en la plataforma que reintente en bucle) y en los endpoints `POST /api/soflia-hub/*` del lado de la plataforma (para protegerse de un Hub comprometido).
- **Logs sin PII cruda:** no loguear el número de teléfono ni el `chat_id` completo en texto plano en logs de aplicación; enmascarar (`+52*******89`).
- **Cifrado en reposo** de `hub_api_key` (columna) usando el mecanismo de secretos ya establecido en el proyecto para credenciales sensibles (revisar `lib/security/` / patrón usado para otros secretos de organización antes de introducir uno nuevo).

---

## 7. Cambios de esquema de base de datos propuestos (referencia — no aplicados)

```sql
-- 1) Registro de Hub por organización
create table public.organization_notification_hub_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  hub_base_url text not null,
  hub_api_key_hash text not null,          -- o cifrado reversible si el flujo lo requiere
  whatsapp_enabled boolean not null default false,
  telegram_enabled boolean not null default false,
  telegram_bot_username text,
  status text not null default 'pending' check (status in ('pending','active','unreachable','disabled')),
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organization_notification_hub_configs enable row level security;
-- RLS: solo service_role + lectura de business-admin de su propia organización (política análoga a notification_settings)

-- 2) Vinculación de canal por usuario (reemplaza confiar en users.phone)
create table public.user_notification_channel_links (
  link_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  channel text not null check (channel in ('whatsapp','telegram')),
  destination text not null,               -- E.164 o telegram chat_id
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notification_channel_links_unique unique (user_id, channel)
);
alter table public.user_notification_channel_links enable row level security;
-- RLS: propio usuario SELECT/DELETE(revocar); service_role ALL

-- 3) Canal telegram en la cola de entregas
alter table public.notification_channel_deliveries
  drop constraint notification_channel_deliveries_channel_check,
  add constraint notification_channel_deliveries_channel_check
    check (channel in ('email','push','sms','whatsapp','telegram'));

-- 4) Preferencia de usuario para telegram
alter table public.user_notification_preferences
  add column if not exists telegram_enabled boolean default false;

-- 5) Feature de plan (capa de aplicación, no SQL): agregar 'notification_telegram'
--    a apps/web/src/lib/subscription/subscriptionFeatures.ts, mismo tier que WhatsApp.
```

**Nota sobre `destination` en `notification_channel_deliveries`:** hoy es `text` libre poblado desde `users.phone`. Tras introducir `user_notification_channel_links`, debe poblarse desde esa tabla (destino verificado), no desde el perfil.

---

## 8. Plan de implementación por fases

| Fase | Alcance | Depende de |
|---|---|---|
| **0 — Reconciliación** | Unificar el catálogo `notification_settings.event_type` con los `notification_type` reales (brecha #6); extraer la lógica de gating duplicada (`delivery-queue.service.ts` / `process-learning-reminders.ts`) a un módulo compartido. | — |
| **1 — Multi-tenencia de config** | Tabla `organization_notification_hub_configs`; UI en business-panel para registrar/rotar Hub; `process-notification-deliveries.ts` enruta por `organization_id`; validación anti-SSRF al guardar y al llamar. | Fase 0 |
| **2 — Vinculación verificada** | Tabla `user_notification_channel_links`; flujo de opt-in WhatsApp (wa.me + token) y Telegram (deep link + `/start`); endpoints `POST /api/soflia-hub/links/*`. | Fase 1 |
| **3 — Canal Telegram** | Migración de `channel` CHECK; `telegram_enabled` en preferencias; UI de preferencias de usuario; generalizar cron y contrato HTTP a multi-canal. | Fase 2 |
| **4 — Cumplimiento WhatsApp** | Flujo de registro/selección de plantilla aprobada por organización; adjuntar `template` en el payload cuando corresponda; bloquear envío si no hay plantilla aprobada y está fuera de ventana 24h. | Fase 1 |
| **5 — Observabilidad** | Vista de solo-lectura en business-panel del estado de `notification_channel_deliveries` de la organización (sent/failed/pending) para soporte de primer nivel. | Fase 1 |
| **6 — Referencia de SofLIA Hub** | Especificación detallada suficiente para que un equipo/agente construya el servicio Node.js desplegable en VPS (adaptadores WhatsApp Cloud API + Telegram Bot API, verificación HMAC, endpoints descritos en §6.6). **Fuera del alcance de este documento** — entregable siguiente si se decide construir el código. | Fases 0–4 |

---

## 9. Riesgos y validaciones pendientes

- **Legal/cumplimiento:** confirmar con cada organización que su cuenta de WhatsApp Business está verificada y que sus plantillas están aprobadas antes de activar el canal — de lo contrario Meta puede restringir la cuenta.
- **Privacidad:** `user_notification_channel_links.destination` y `hub_api_key_hash` son datos sensibles; deben excluirse de cualquier exportación/backup no cifrado y de logs.
- **Disponibilidad:** si el Hub de una organización está caído, las entregas deben acumularse en `pending`/`failed` con backoff (ya existe) y no deben bloquear el procesamiento de otras organizaciones (el nuevo enrutamiento por `organization_id` debe iterar Hubs independientemente, con timeout por Hub).
- **Idempotencia:** el `UNIQUE (notification_id, channel)` en `notification_channel_deliveries` ya cubre reintentos duplicados del lado plataforma; el Hub debe tratar `deliveryId` como clave de idempotencia si reintenta hacia el proveedor.
- **Qué no cubre este documento:** el código del servicio SofLIA Hub en sí (Fase 6), la UI final de vinculación en `features/profile/`, y el mecanismo exacto de cifrado de `hub_api_key` (debe alinearse con el patrón ya usado en `lib/security/` para secretos de organización, que no fue auditado en profundidad en esta investigación).

---

## 10. Referencias de archivos citados

- `netlify/functions/process-notification-deliveries.ts` — cron de entrega WhatsApp actual.
- `netlify/functions/process-learning-reminders.ts` — generador del recordatorio "avanza tu curso".
- `supabase/migrations/20260625090000_notifications_v1_channels_and_actions.sql` — esquema v1 (whatsapp, deliveries, RPCs).
- `apps/web/src/features/notifications/services/notification/creation.service.ts` — creación y despacho de notificaciones.
- `apps/web/src/features/notifications/services/notification/delivery-queue.service.ts` — gating y encolado de WhatsApp.
- `apps/web/src/features/notifications/services/notification/catalog.ts` — catálogo de canales y defaults por tipo.
- `apps/web/src/features/notifications/services/notification-settings.catalog.ts` — catálogo de eventos de negocio (org-level).
- `apps/web/src/app/api/[orgSlug]/business/notifications/settings/route.ts` — API de configuración de organización.
- `apps/web/src/lib/subscription/subscriptionFeatures.ts` — gating de canales por plan.
- `apps/web/src/lib/supabase/types.ts` — tipos generados (`users.phone/country_code`, `user_notifications`, `user_notification_preferences`).
- `README.md` — variables de entorno `SOFLIA_HUB_*` actuales.
