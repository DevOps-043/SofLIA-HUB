## 1. Contrato y datos

- [x] 1.1 Crear migración IRIS aditiva con identidad SOFIA, evidencia, actividad, idempotencia, outbox, membresía auditable y bucket privado.
- [x] 1.2 Publicar OpenAPI 3.1 de `/api/v1` y esquemas Zod compartidos.
- [x] 1.3 Implementar intercambio SOFIA y autorización por workspace/proyecto.

## 2. API Project Hub

- [x] 2.1 Implementar proyectos, tareas, miembros y evidencias.
- [x] 2.2 Implementar uploads privados, referencias Drive y analítica.
- [x] 2.3 Implementar colecciones versionadas e importación transaccional de reuniones.
- [x] 2.4 Delegar `/api/ext/projects` y `/api/ext/issues` al servicio v1 y añadir deprecación.

## 3. SofLIA-HUB

- [x] 3.1 Implementar cliente main, refresh single-flight y refresh token cifrado.
- [x] 3.2 Completar handler, allowlist/preload, tipo global y wrapper renderer.
- [x] 3.3 Separar proyectos nuevos de carpetas heredadas y crear vista unificada.
- [x] 3.4 Integrar revisión de reuniones y colecciones del navegador con HITL.

## 4. Calidad y operación

- [x] 4.1 Añadir pruebas unitarias, autorización, IPC, idempotencia y saneamiento.
- [x] 4.2 Actualizar documentación canónica de arquitectura, datos, IPC y pruebas.
- [x] 4.3 Ejecutar pruebas dirigidas, typecheck, harness, docs, lint cambiado y `verify:pr`.
- [x] 4.4 Registrar comandos, resultados, negativos y riesgo residual en `reports/verification.md`.
