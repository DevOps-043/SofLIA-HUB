# Diccionario de datos

Estado: vigente. Actualizado: 2026-07-21.

`Usada` significa que existe una referencia `.from('<tabla>')` en codigo de
producto. `Snapshot` significa contrato disponible en el dump, no consumo ni
existencia productiva verificada.

<!-- evidence: database/lia/snapshots/schema.sql -->
<!-- evidence: database/iris/snapshots/schema.sql -->
<!-- evidence: database/sofia-learning/snapshots/schema.sql -->
<!-- evidence: electron/memory/schema.ts -->

## Lia: tablas usadas por el Hub

| Tabla | Funcion y claves relevantes | Ownership/relaciones |
|---|---|---|
| `profiles` | perfil operativo Lia | enlaza usuario resuelto; no es auth principal |
| `conversations` | chat, title, owner/org, pin/share flags, `deleted_at` | padre de messages; acceso por user/org/shares; borrado logico: `deleted_at IS NULL` es lo unico que se lista |
| `messages` | roles, contenido, metadata/tool data | pertenece a conversation; politicas update/delete dedicadas |
| `folders` | agrupacion/Project Hub | owner/org; relacion con conversaciones |
| `user_ai_settings` | personalidad/modelo/preferencias | por user_id |
| `api_keys` | referencias/config de proveedor | nunca documentar valor; acceso por usuario |
| `user_tools` | tools habilitadas por usuario | relacion usuario-tool |
| `workspace_sources` | archivo/Drive/source ligado a proyecto | owner/folder/conversation segun servicio |
| `conversation_shares`, `folder_shares` | grants/enlaces de colaboracion | owner, target y receptor/token |
| `monitoring_sessions` | bloque laboral, trigger, tiempos, summary/status | `user_id`; padre de activity_logs |
| `activity_logs` | ventana/proceso/url/categoria/idle/OCR | cascade por session |
| `daily_summaries` | agregado diario unico por usuario/fecha | top apps/sites/projects JSON |
| `calendar_connections` | provider, tokens, expiry y calendar id | unico user/provider; dato altamente sensible |
| `meeting_runs` | cabecera de pipeline y `trace_id` unico | owner, org, source hash/version |
| `meeting_source_artifacts` | texto normalizado, SHA-256, autoridad y metadata | cascade por run |
| `meeting_assets` | payload versionado, resumen, flags, confidence | unico run/version |
| `meeting_sync_actions` | accion, target, approval/sync state e idempotency | run+asset; external_ref |
| `meeting_approvals` | scope, solicitante, decisor, decision/comentario | cascade por run |
| `meeting_detection_candidates` | dedupe y estado de candidatos calendar/gmail/drive | detection_key unico; run nullable |
| `hub_service_state` | espejo JSON por nombre de servicio | PK `service_name`, updated_at |

## Lia: contratos en snapshot sin referencia `.from()` actual directa

| Subsistema | Tablas | Lectura correcta |
|---|---|---|
| Feedback/tools | `message_feedback`, `tools`, `user_favorite_tools` | schema disponible; consumo actual no demostrado por busqueda estatica |
| Meetings legacy | `meeting_sessions`, `transcript_segments`, `meeting_action_items`, `meeting_exports` | no confundir con Meeting Ops nuevo |
| CRM legacy | `crm_companies`, `crm_contacts`, `crm_opportunities`, `crm_interactions` | tests/servicios legacy pueden existir, pero bootstrap no construye CRM service |
| Workflow legacy | `workflow_definitions`, `workflow_runs`, `workflow_step_runs`, `workflow_artifacts`, `workflow_approvals` | El Workflow Hub se retiro del producto; estas tablas quedaron sin consumidor |
| Estado de servicios | `hub_service_state` | Espejo por servicio, fila global sin `user_id` y politica permisiva. Las Skills pasivas YA NO lo usan (viven en `passive_skills`); su fila `task-scheduler` se conserva una version como red de seguridad |
| Skills pasivas | `passive_skills` | Una fila por rutina programada, con `user_id` y `profile`. Fuente de verdad; el JSON del planificador es cache de arranque. Requiere que main opere con sesion |
| Ajustes por Skill | `user_skill_settings` | Canales, herramientas y busqueda web por usuario y Skill. `tools` a NULL = sin eleccion (toda la superficie); array vacio = ninguna. Sustituye a `user_skill_channels`, que se conserva una version |
| Canales por Skill (retirada) | `user_skill_channels` | Una fila por Skill configurada. La AUSENCIA de fila no retira canales: la Skill queda activa en todos los que declara su catalogo |

## IRIS: tablas consumidas

| Tabla | Funcion | Claves/relaciones |
|---|---|---|
| `account_users` | identidad/cuenta IRIS | resuelve usuario para asignaciones |
| `teams`, `team_members` | equipos y miembros | team/org IDs compartidos por aplicacion |
| `pm_projects`, `pm_project_members` | proyectos y membresia | project/team/workspace |
| `task_issues` | issue, numero, proyecto/equipo/asignee | estados/prioridad/ciclo y relaciones |
| `task_statuses`, `task_priorities` | catalogos de workflow | usados para crear/actualizar issues |

El codigo tambien contiene compatibilidad con `project_members`; el snapshot IRIS
versionado declara `pm_project_members`, no `project_members`. Esa diferencia debe
verificarse contra la instancia antes de cambiar consultas.

## IRIS: resto del snapshot por dominio

| Dominio | Tablas snapshot |
|---|---|
| Auth y seguridad | `auth_email_verifications`, `auth_login_history`, `auth_oauth_providers`, `auth_password_resets`, `auth_sessions`, `auth_refresh_tokens`, `user_permissions`, `mcp_api_keys` |
| Proyecto | `pm_milestones`, `pm_project_progress_history`, `pm_project_updates`, `pm_project_views`, `pm_project_documents` |
| Issues | `task_cycles`, `task_labels`, `task_issue_comments`, `task_issue_attachments`, `task_issue_history`, `task_issue_labels`, `task_issue_relations`, `task_issue_subscribers`, `task_saved_views`, `task_issue_documents` |
| Workspace/comunicacion | `workspaces`, `workspace_members`, `notifications`, `user_notification_preferences`, `faqs`, `focus_sessions` |
| IA/uso | `aria_chat_attachments`, `aria_usage_logs` |
| Meeting residual | `meeting_runs`, `meeting_source_artifacts`, `meeting_assets`, `meeting_sync_actions`, `meeting_approvals`, `meeting_detection_candidates` deben retirarse con la migracion IRIS correspondiente |

## SOFIA Learning: tablas usadas por el Hub

| Tabla | Uso |
|---|---|
| `users` | principal de usuario/perfil SOFIA |
| `organization_users` | memberships, rol, status, team/zone/region |
| `organizations` | organizacion, plan, branding y estado |
| `organization_teams` | equipos de la organizacion |

## SOFIA Learning: inventario snapshot por dominio

| Dominio | Tablas snapshot |
|---|---|
| Moderacion/auditoria | `ai_moderation_config`, `ai_moderation_logs`, `user_warnings`, `audit_logs`, `forbidden_words`, `reportes_problemas` |
| Cursos/contenido | `courses`, `course_modules`, `course_lessons`, `course_lessons_en`, `course_lessons_pt`, `lesson_activities`, `lesson_checkpoints`, `lesson_feedback`, `lesson_materials`, `lesson_time_estimates`, `content_translations`, `course_reviews`, `course_skills` |
| Preguntas/learning | `course_questions`, `course_question_reactions`, `course_question_responses`, `user_course_enrollments`, `user_lesson_notes`, `user_lesson_progress`, `user_quiz_submissions`, `lesson_tracking`, `daily_progress`, `user_streaks`, `lia_activity_completions` |
| Certificados/pagos | `certificate_ledger`, `certificate_templates`, `user_course_certificates`, `subscriptions`, `transactions`, `payment_methods`, `organization_course_purchases` |
| Auth/notificaciones | `oauth_accounts`, `password_reset_tokens`, `refresh_tokens`, `user_session`, `notification_email_queue`, `notification_push_subscriptions`, `notification_settings`, `notification_stats`, `user_notifications`, `user_notification_preferences` |
| Organizacion | `organization_analytics`, `organization_course_assignments`, `organization_users`, `organizations`, `user_invitations`, `bulk_invite_links`, `bulk_invite_registrations`, `organization_regions`, `organization_zones`, `organization_teams`, `organization_structures`, `organization_nodes`, `organization_node_users`, `organization_node_courses`, `organization_join_requests` |
| Jerarquia | `hierarchy_chats`, `hierarchy_chat_messages`, `hierarchy_chat_participants`, `hierarchy_course_assignments`, `region_course_assignments`, `zone_course_assignments`, `team_course_assignments` |
| Lia Learning | `lia_conversations`, `lia_messages`, `lia_common_questions`, `lia_user_feedback`, `lia_personalization_settings`, `lesson_chat_suggestions` |
| Planner/ingesta | `planner_policies`, `planner_policy_versions`, `planner_policy_scopes`, `planner_audit_log`, `courseengine_inbox`, `courses_staging`, `organization_planner_config`, `organization_holidays` |
| Learning paths/evaluacion | `user_activity_submissions`, `user_activity_evaluations`, `learning_paths`, `learning_path_items`, `organization_learning_path_assignments`, `user_learning_path_assignments`, `user_learning_path_progress` |
| Analitica/UX | `dashboard_layouts`, `user_activity_log`, `user_tour_progress`, `business_user_analytics_insight_cache`, `organization_course_intro_videos`, `activity_logs`, `daily_summaries`, `calendar_connections`, `user_favorite_tools` |

## SQLite local

| Tabla | Campos clave | Regla |
|---|---|---|
| `messages` | session_key, phone_number, owner_key, group_jid, role, content, media, timestamp | role solo `user|model`; indices por session/phone/time |
| `summaries` | session, periodo, text, count | orden por period_end |
| `memory_chunks` | chunk, embedding JSON, source_type y rango | source `conversation|summary|fact` |
| `facts` | phone, category, key, value, confidence | unico por phone/category/key |
| `skills` | owner, type, title, content, trigger, confidence/usage | unico por owner/type/title |
| `event_stream` | agent_id, task_id, thought_data, status/context/update | pensamientos; no expuesto al renderer como autoridad |
| FTS `docs` | filepath, filename, content | filepath no indexado; tokenizer porter |

## Clasificacion y datos sensibles

Tokens OAuth/WhatsApp/SMTP, API keys, contenido de mensajes, OCR/screenshots,
transcripciones, `source_refs`, `before_json/after_json` y memoria son sensibles.
Anon keys Vite no son secretos privilegiados, pero nunca compensan RLS permisivo.
