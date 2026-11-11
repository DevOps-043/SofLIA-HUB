## Context

Ver [motivación](proposal.md) y [contrato](specs/auth-state-source-authorization/spec.md). La guarda IPC existente une identidad autenticada y fuente nativa; Auth necesita la misma fuente sin requerir sesión para bootstrap. Los servicios SDK main ya pueden persistir durante sus propias esperas.

## Goals / Non-Goals

- Autorizar con objetos nativos y getters vivos del estado bootstrap, nunca IDs declarados en payload, URL de renderer ni sesión previa.
- Conservar servicios de negocio, canales y allowlist actuales, política legacy sin SOFIA y autorizaciones autenticadas de los demás consumidores.
- No ampliar esta unidad a aislamiento transaccional de todos los SDK main, tokens del servidor, RLS ni UI.

## Decisions

1. Extraer una lease de fuente en electron/ipc/renderer-source.ts. Comprueba pertenencia por identidad de ventana/webContents, marco principal exacto y documento propio; observa navegación principal, caída y destrucción. La guarda autenticada existente compone esa lease con su snapshot de sesión. Duplicar autorización en Auth dejaría reglas divergentes; usar la guarda autenticada directamente rompería bootstrap.
2. Registrar Auth con getters separados Hub/Orbe. Sólo Hub entra en la allowlist de escritura; ambos leen. La invocación captura su fuente, y la revalida después de await y junto a la revisión existente. Los rechazos de fuente devuelven snapshot negado; no revelan getAuthState.
3. DTO compartido puro bajo src/shared y parser main separado: cuotas constantes, claves conocidas, tipos precisos, controles rechazados, pares completos, null/ausencia compatibles. El límite amplio por token no pretende validar JWT. La organización se aplica sólo al publicar el resultado verificado, no antes de verificar SOFIA.
4. try/catch/finally en handler, mensajes estáticos y liberación idempotente. No compensar fallos con un logout global: podría cerrar una sesión posterior. La respuesta conserva la forma ok/state existente. Preload diferencia entrada con credenciales de snapshot de salida y wrapper hace observable el rechazo con diagnóstico estático.

## Risks / Trade-offs

- Guarda compartida → regresiones dirigidas de consumidores autenticados, navegación y limpieza más compuerta completa.
- Ventana válida comprometida → esta unidad no sustituye XSS, verificación de identidad ni autorización del servidor.
- SDK ya invocado → puede persistir o mutar durante una espera; la lease impide pasos posteriores y publicación tardía, sin prometer rollback físico ni atomicidad global main.
- Pruebas con puertos nativos sustituidos → acreditan contratos y secuencia, no un arranque GUI real. No se ejecuta la vista previamente bloqueada por seguridad por otra vía.

## Migration Plan

Cambio local sin dependencias, SQL ni datos nuevos. Verificar primero regresiones y cuatro capas, luego verify:pr y build aislado sin inicio de app. Actualizar documentación canónica y evidencia. Rollback restaura exclusivamente los archivos de esta unidad desde su copia previa en TEMP; conservar los cambios acumulados. No archivar sin revisión independiente.
