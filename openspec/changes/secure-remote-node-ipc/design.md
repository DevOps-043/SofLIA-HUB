## Context

Ver [propuesta](proposal.md) y [contexto](context-pack.md). Hay 13 handlers sin guardas, contratos compartidos recién tipados y cliente remoto sin límites físicos. Las guardas comunes de fuente/sesión y confirmación nativa ya se usan en calendario y Project Hub.

## Goals / Non-Goals

Cerrar el recorrido IPC completo sin API de autoridad nueva para renderer. El almacén sigue global/plano; no atribuirle ownership/cifrado ni extender esta garantía a todas las llamadas runtime main o HTTP entrante.

## Decisions

- Reutilizar trustedAppCaller/nativeConfirmation; inyectar getters Hub/Orbe desde startup, sin descubrir ventanas por URL ni permitir fallback sin ventanas. No duplicar guardas.
- Schemas compartidos cerrados derivados de campos realmente consumidos. URLs HTTP(S) sin credenciales/query/hash, IDs acotados, comandos/tareas 20000 caracteres, token 4096, rutas 4096, puerto entero 1–65535 y max_steps entero 1–1000. Snapshot acotado antes de parsear para evitar getters/estructuras ajenas; límites publicados como política local.
- Mantener DTO exitoso host; consultas/configuración fallidas rechazan con mensaje fijo. Otras operaciones devuelven sobre controlado tipado con cancelled/uncertain/code. No mostrar token en diálogos/logs ni propagar errores de proveedores.
- Servicio captura revisión de configuración interna, incrementada al registrar/eliminar/configurar; se comprueba tras revisión y justo antes de efectos/HTTP. Datos de salud no invalidan la revisión. La mutación propia invalida su revisión para usos futuros, sin convertir su éxito en fallo por auto-invalidación.
- Contexto de operación main opcional para consumidores existentes, con assertCurrent y AbortSignal; la ruta IPC lo suministra siempre. Cliente HTTP conserva compatibilidad standalone, combina cancelación con deadline y limita lectura incremental, incluyendo content-length y bytes reales; redirects rechazados para no reenviar tokens a otro destino.
- No reintentar mutaciones. El handler distingue fallo previo de operación admitida con posibles efectos; tras envío la cancelación se trata como resultado incierto, sin afirmar reversión.
- Durante la integración se confirmó que cambiar bind_address con igual puerto conservaba la interfaz anterior. Registrar el binding efectivo y serializar reconciliación del servidor hacia la última configuración evita exponer una interfaz que el usuario acaba de restringir. Pruebas con puertos nativos sustituidos, sin sockets reales.
- La revisión final confirmó que la ruta de escritorio espera executeTask hasta terminar. Un plazo global de 60 s interrumpiría tareas habituales: conservar 60 s para consultas/acciones breves y dar 15 minutos acotados a esa ruta, con la misma cancelación y respuesta incierta. Se repite verificación final tras este ajuste de compatibilidad.

## Risks / Trade-offs

- Cancelación no revierte efectos remotos → respuesta incierta y revisión manual antes de repetir.
- Cambio de registro ajeno invalida una aprobación → denegar/reintentar con nueva revisión, preferible a ejecutar un destino cambiado.
- Schemas cerrados rechazan campos ignorados → proyectar argumentos existentes en wrappers y probar ambos recorridos renderer; no aceptar campos arbitrarios.
- Capturas grandes → 20 MiB explícitos y prueba negativa; no bajar límites para maquillar cobertura.

## Migration Plan

Respaldos relativos y comparación contra unidad 38. Integrar contratos/servicio/handler/arranque/preload/renderer juntos. Pruebas causales negativas, dirigidas y una compuerta final con cobertura/build sobre hashes estables. Revertir sólo el delta; sin datos ni despliegue. Revisión independiente pendiente, no archivar.
