# Evidencia de integración multiagente

Estado: implementación verificada localmente; revisión independiente pendiente. Fecha: 2026-09-22.

## Línea base

Base Git: 5bbf244. Rama codex/integrate-multiagent-harness; worktree aislado.
El informe de investigación y su índice permanecen intactos en el checkout original.
No se cambiaron secretos ni archivos .env.

Typecheck inicial falló por dos defectos previos: Promise sin genérico en
browser-sync-state-recovery.test.ts y MessageUpdateEntry sin uso en
whatsapp/delivery-events.ts. Se aplicaron correcciones mínimas para permitir
verificar tipos sin ocultar diagnósticos.

## Resultados obtenidos

- Primera batería: 17 pruebas aprobadas.
- Segunda batería: 24 pruebas aprobadas.
- Batería con guardas y smoke nativo: 28 pruebas aprobadas, ocho archivos.
- Batería final: 36 pruebas aprobadas, nueve archivos. Incluye persistencia
  fallida, aprobación caducada durante autorización, límites y sesión SOFIA/Lia.
- Typecheck: aprobado después de las dos correcciones mínimas de línea base.
- lint:changed: aprobado sin deuda nueva.
- build:app: aprobado; genera renderer, main y preload. No se empaquetó instalador.
- docs:system:check, docs:check, harness:validate y OpenSpec del cambio: aprobados.
- verify:pr: ejecutado; aprobó adaptadores, arnés, cadena de suministro y
  documentación, y se detuvo en skills:seed:check por divergencia preexistente
  entre system-skills-catalog.sql y registry.ts. Reproducido en checkout original.
- Suite completa ejecutada con cuatro workers: 3313 pruebas aprobadas,
  dos fallidas y una omitida (smoke nativo opt-in); 317 archivos aprobados,
  dos fallidos y uno omitido. Esta corrida precede las últimas pruebas añadidas.
  El fallo WA-160 de presentaciones se reprodujo en checkout original
  (espera index.html y obtiene deck.json). El test de gráfica del reproductor
  falló bajo carga y pasó en la comprobación aislada de base; no se atribuye
  una causa confirmada ni se presenta la suite como verde.
- Codex local: codex-cli 0.155.0-alpha.9.2. Se generó esquema experimental y
  completó initialize/initialized, thread/start con environments vacío y
  mcpServerStatus/list vacío, con hogar temporal aislado y autenticación efímera
  configurada. No hubo inferencia ni uso de credenciales reales. La comprobación
  contra el esquema real corrigió sandbox a read-only; el ejemplo documental
  no se utilizó como sustituto de ese contrato.

## Revisión adversarial

La revisión independiente solicitada falló por falta de créditos del servicio
de subagentes. No produjo un dictamen; el cambio no se archiva como revisado
independientemente.

La revisión local detectó y corrigió: confusión de identidades SOFIA/Lia,
operaciones después de cambio de sesión, deduplicación entre organizaciones,
resultados tardíos, confirmaciones duplicadas/caducadas, buffers RPC excesivos,
configuración de herramientas locales y conectores heredados, persistencia sin
cifrado y restauración de confirmaciones tras reinicio.

Se añadieron guardas entre etapas de creación del borrador y entre borrado e
inserción de acciones draft, sin alterar la ruta de aprobación/sincronización
existente. La deduplicación solo reutiliza un run de la misma organización.
La confirmación se registra antes del efecto; si falla esa escritura local,
no se llama al servicio de reuniones. Los errores de almacenamiento final se
muestran y retiran la posibilidad de publicar el resultado.

## Comandos reproducibles

- npm run typecheck
- npm run lint:changed
- npm run build:app
- npm run docs:system:check
- npm run docs:check
- npm run harness:validate
- npx --no-install openspec validate integrate-multiagent-harness --strict --no-interactive
- npm run test -- --maxWorkers=4
- npm run verify:pr

Las suites nuevas son agent-runtime, agent-runtime-repository, agent-runtime-ipc,
agent-runtime-meeting-guard, agent-runtime-composition, codex-runtime,
codex-runtime-provider, codex-runtime-native y multi-agent-panel.
Para incluir el smoke nativo, fijar SOFLIA_CODEX_TEST_EXECUTABLE a la ruta
absoluta del binario instalado durante esa invocación; no modifica configuración
personal. La batería es reproducible con vitest run sobre esos nueve archivos.

## Límites

Sin prueba de inferencia facturable, sin métricas comparativas de calidad/costo,
sin prueba del instalador ni publicación. El protocolo Codex usa campos
experimentales comprobados al ejecutar. El DAG multiagente lo controla SofLIA;
no se habilita spawn nativo recursivo de Codex ni Agents API hospedada.
