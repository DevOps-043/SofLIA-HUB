# Contexto del cambio

- Objetivo: impedir nuevos errores de lint tanto en commits de PR como en código local y scripts JavaScript, sin ampliar la deuda histórica aceptada.
- Usuario o actor: desarrollador, verify:pr y CI con HARNESS_BASE_REF; Git, rutas y configuración ESLint son fronteras del tooling.
- Alcance: selección Git con NUL, referencias verificadas, comparación por ancestro/HEAD, ocho extensiones TS/JS, contextos ESLint explícitos y pruebas CLI en repositorios temporales; corregir incidencias nuevas descubiertas en scripts propios.
- No objetivos: cambiar reglas de negocio, IPC, permisos o dependencias; lint del contenido del índice como artefacto separado; checkout/stage/commit del workspace; certificar ausencia de deuda global.
- Restricciones: preservar 25 unidades y trabajo ajeno; ninguna migración, secreto/.env, publicación o borrado de archivos del usuario. Git commits sólo en fixtures de QA propios con hooks/firma desactivados por comando.
- Contratos afectados: lint:changed deja de aceptar regresiones ya comprometidas en CI y omisiones JS. El gate conserva scripts, umbrales y separación main/preload/renderer.
- Riesgo y HITL: la compuerta se vuelve más estricta y puede revelar deuda no revisada. No inventar baseline ni silenciar reglas para pasar; metadata y contextos Node/browser se aplican también a HEAD para comparación coherente.
- Criterios verificables: rechazo de commit con incidencia nueva, .mjs/.cjs/.jsx/.mts/.cts además de .ts/.tsx/.js, nuevas reglas/severidad/cantidad, base inválida, parser fatal y rutas con espacios/Unicode; conservación de deuda histórica comparable y exclusiones explícitas.
- Incertidumbres: el tiempo de suite depende de carga local; no es benchmark. La revisión independiente y los bloqueos externos IRIS/Intel Python continúan pendientes.
