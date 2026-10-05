# Evidencia de equipos transversales

Fecha: 2026-09-23. Base: 61cbadf. Rama: codex/extend-runtime-multiagents.
Estado: implementación, revisión independiente, compilación y compuerta de PR aprobadas.

La integración posterior del catálogo y los conflictos del merge se verifican
en [Resolución del merge](merge-resolution.md), con fecha 2026-10-05.

## Alcance comprobado

Selección automática y modos por turno, workers Gemini/OpenAI sin herramientas,
contexto acotado, paralelismo de dos especialistas, límite de cuatro peticiones
reales pendientes por proceso, degradación parcial y cancelación con descarte
tardío. Integración en chat/navegador, WhatsApp, Computer Use actual y planificador
legacy, y generador dedicado de presentaciones WhatsApp.

## Revisión adversarial independiente

El revisor encontró y se corrigieron tres problemas:

- La cuota Max se descontaba después de los workers: se reserva una vez antes
  de la primera petición real, tras validar el cliente, aunque se cancele.
- La clasificación de acción WhatsApp usaba solicitud más aportes: ahora se
  clasifica exclusivamente la solicitud original y se enriquece otro campo.
- El modo directo no alcanzaba el generador de presentaciones: ahora se propaga
  desde los datos/aprobación del flujo. Cancelar aborta workers y detiene las
  siguientes escrituras/exportación/envío. Un efecto ya iniciado no se revierte.

El revisor volvió a comprobar los arreglos y ejecutó 72 pruebas en cuatro
archivos, todas aprobadas. Una observación menor sobre la ventana de cancelación
al exportar se corrigió añadiendo guardas antes/después de exportar y entre
escrituras de estilos.

## Resultados de pruebas

- Batería inicial de núcleo, cliente CU y etiquetas: 22 aprobadas.
- Batería de siete archivos de integración/regresión: 82 aprobadas.
- Batería tras las correcciones de autoridad, cuota y presentación: 59 aprobadas.
- Primera compuerta completa: tipos, lint, arnés, documentos, semilla, OpenSpec
  y auditoría aprobados. Suite: 3527 pruebas aprobadas, una fallida y una omitida.
  Fallo en BrowserWorkspaceLayout: esperaba gpt-5.6-luna para SofLIA Pro aunque
  el catálogo vigente usa el modelo runtime Gemini. Reproducido en un worktree
  limpio de 61cbadf; 11 pruebas aprobadas y el mismo fallo. Se actualizó sólo la
  expectativa, en commit separado d9b6f55; las 12 pruebas de ese archivo pasan.
- build:app aprobado: renderer, main y preload. Sin empaquetar instalador.
- docs:check aprobado en 317 Markdown activos; docs:system:check aprobado:
  28 documentos, 150 IDs, 437 canales y 499 archivos de prueba derivados.
- OpenSpec del cambio aprobado en modo estricto.
- Compuerta final `npm run verify:pr` aprobada completa. Suite: 3528 pruebas
  aprobadas, una omitida; 333 archivos aprobados y uno omitido. Duración de
  Vitest: 105,13 segundos. Incluye las regresiones de cuota/cancelación,
  autoridad WhatsApp y modo directo de presentaciones.
- No se han ejecutado llamadas facturables, envíos reales ni acciones en escritorio.

## Reproducción

- `npm run verify:pr`: adaptadores, arnés, cadena de suministro, inventario,
  enlaces, semilla, OpenSpec, tipos, lint y suite completa.
- `npm run build:app`: compilación de la aplicación.
- `npx --no-install vitest run src/__tests__/services/agent-teams.test.ts src/__tests__/services/chat-agent-team.test.ts electron/__tests__/cross-surface-agent-team.test.ts electron/__tests__/whatsapp-team-authority.test.ts`: núcleo y adaptadores nuevos.
- `npx --no-install vitest run src/__tests__/services/gemini-chat-routing.test.ts electron/__tests__/whatsapp-workflow-presentacion.test.ts`: regresiones de integración y aprobación.

Los logs locales verify-pr.log, verify-pr-final.log y build-app.log se conservan
en este directorio y están excluidos de Git. La evidencia versionada es este
reporte y las pruebas; no se copian datos del entorno ni secretos.

## Límites de la evidencia

Los proveedores se prueban con dobles. Se demuestra concurrencia mediante
barreras, no una mejora real de latencia o calidad. Los especialistas son de
preparación/análisis: no abren páginas, escriben documentos o manejan pantallas
independientemente. El coordinador existente materializa y verifica. No se añade
Codex al resto de superficies ni persistencia/reanudación de estos equipos.

## Reversión

Retirar las llamadas a prepareChatTeam, prepareWhatsAppTeam y runAgentTeam en
los clientes/generadores integrados devuelve la preparación al coordinador
único. No hay migraciones ni credenciales nuevas. Las guardas de cancelación
y las correcciones de cuota pueden conservarse independientemente.
