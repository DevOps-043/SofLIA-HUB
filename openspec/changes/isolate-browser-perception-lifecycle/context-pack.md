# Contexto del cambio

- Objetivo: reducir estado/coordinación transversal de percepción en el servicio del navegador y evitar resultados de un ciclo revocado.
- Actor: usuario que pausa percepción, cambia política/documento/perfil/ventana o solicita observación explícita mientras una captura nativa está pendiente.
- Alcance: propiedad del estado efímero, cachés, trabajos en curso, invalidación y temporizador pasivo; guardas existentes de autorización/documento sensible y fachada de servicio conservadas.
- No objetivos: nuevas capacidades, canales IPC, permisos, cambios de cadencia, persistencia, proveedores, modelo de visión o control real del escritorio.
- Restricciones: conservar 26 unidades y cambios ajenos en rama actual; sin secretos/.env, SQL, publicación o commits del workspace. No existe copia limpia equivalente de este estado acumulado; no trasladarlo a otro worktree.
- Contratos afectados: sólo implementación interna main. API pública, tipos serializados, handlers, allowlist/preload y wrappers deben permanecer compatibles.
- Riesgo confirmado por regresión roja: una promesa pendiente publica el frame anterior después de pausar/reactivar. Se conserva evidencia en el reporte; además se prueban limpieza, errores y esperas antes de efectos.
- Criterios: promesas de ciclos anteriores no publican caché/error ni satisfacen nueva solicitud; trabajos físicos serializados por tipo sin solapamiento nuevo; single-flight del mismo documento vigente; invalida por documento/perfil y evita ABA; conservar política/sensibilidad, caché compatible y timer dirigido por eventos.
- Evidencia: regresiones rojas, contratos del módulo y servicio, smoke de percepción/navegación en Electron real, gate/build con fuentes congeladas y documentación canónica.
- Incertidumbres: capturePage no expone cancelación física; invalidación lógica no equivale a cancelarlo. Revisión independiente, IRIS e Intel Python siguen pendientes.
