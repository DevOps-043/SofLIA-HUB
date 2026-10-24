## Context

ProjectHubApiService mezcla rutas, HTTP y credenciales globales. El canje/refresh escriben después de cualquier await sin comprobar propietario/revisión. Logout espera red antes de borrar memoria/disco. auth:set-state verifica SOFIA y establece main AuthState antes de canjear; conserva también un modo compatible sin token. Por eso la raíz local exige que usuario main e identidad de la sesión SOFIA verificada coincidan. El booleano compatible por sí solo no abre la custodia.

## Goals / Non-Goals

**Goals:** custodia por propietario, invalidación A/B/A y logout, autenticación concurrente consistente, solicitudes ligadas a identidad y HTTP acotado, con API integrada conservada.

**Non-Goals:** cambiar backend/identidad, implementar borrado, corregir RLS remotamente, sustituir guardas de caller/HITL pendientes, auditar revocación JWT del servidor.

## Decisions

- ProjectHubSessionStore usa systemCipher y private-files existentes: cifrado asíncrono, sin basic_text/unknown, nombres hash, payload versionado con propietario y cuotas. Serializa lectura/escritura/clear; temporal sólo cifrado y validación antes/después de I/O. Tokens de acceso no se persisten.
- El archivo global heredado no tiene propietario comprobable: se conserva sin leer/adjudicar y no se usa como fallback. El canje SOFIA existente obtiene una sesión nueva. Falla de custodia deja autenticación de esa instancia sólo en memoria, con aviso fijo sin payload.
- Capturar usuario main y suscribir cambios durante cada operación, más revisión/control de cancelación propios. Comprobar tras awaits, antes de red y antes/después de persistir. A/B/A invalida aunque el identificador final coincida. No confiar en userId enviado en payload.
- El controlador de autenticación mantiene sesión y token SOFIA por dueño; secuencia de canjes y referencia de sesión impiden que refresh/canje antiguos borren o sustituyan los nuevos. Single-flight por contexto vigente. Logout retira memoria/invalida inmediatamente y encola clear antes de esperar red; revoca usando sólo su token capturado.
- El transporte no consulta credenciales globales: recibe snapshot de acceso y señal. HTTPS excepto loopback explícito de desarrollo, sin credenciales/query/fragment en base URL; redirect=error. Máximo 2 MiB de JSON saliente y 4 MiB entrante, timeout HTTP de 15 s. Validar envelope/data/auth; workspaces acotados y tokens nunca públicos.
- Conservar dos retries de fallos de red para GET con backoff cancelable 250/500 ms y un único refresh ante 401 seguido de una lectura. Mutaciones no se repiten automáticamente, ni después de 401. Un acceso vencido no se reutiliza si falla su renovación. Errores públicos por categoría/HTTP sin code/message remoto crudo. La autoridad del workspace sigue en el servidor.
- No agregar canales ni alterar wrappers. getStatus sin identidad devuelve configuración y estado vacío, sin leer custodia/red. Lecturas/escrituras del servicio requieren dueño main vigente, aun desde consumidores internos.

## Risks / Trade-offs

La primera sesión del formato nuevo puede requerir canje; no se migra un archivo sin dueño por conveniencia. Persistencia no disponible implica nueva autenticación al reiniciar. Un efecto remoto ya enviado puede completarse pese a cancelación: no prometer rollback; nunca repetirlo por recuperación de autenticación. La revocación de JWT/RLS y autorización por frame/HITL de handlers requieren verificación propia del servidor/frontera, fuera de esta custodia.

## Migration Plan

Baseline y regresiones rojas, módulos/consumidores, archivo temporal real, servidor HTTP local con tokens ficticios, smoke DPAPI de procesos separados, tipos/lint/build/gate. Revertir módulos y fachada juntos sin tocar once unidades anteriores; legado conservado y formatos separados. Revisión independiente antes de archivar.
