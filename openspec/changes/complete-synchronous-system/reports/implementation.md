# Cierre local del sistema síncrono

Fecha: 2026-11-03. Estado: código implementado y verificado localmente; SQL aprobado de Learning principal aplicado. Despliegue y piloto pendientes.

## Bases y ubicación

Rama coordinada codex/complete-synchronous-system. Hub parte de db0827f8 (consolidación del 26 de octubre), Learning de 73b88201 (Video SDK) y Engine de a4062883 (staging). Los worktrees principales ajenos de Hub y Learning se conservaron; Engine trabaja en su checkout principal según AGENTS.md. No se publicaron ramas ni se modificaron secretos. La operación remota posterior se limitó a las dos migraciones aprobadas de Learning y las consultas de verificación descritas abajo.

## Resultado

- Learning completa participación transaccional y negociación legacy. El reloj SQL impone cadencia y deduplicación; no acepta marcas elegidas por el cliente.
- Engine consulta sesiones autorizadas y entrega láminas/prácticas aprobadas con contrato canónico, HMAC, propósito y timestamp. Learning revalida actor, organización, curso, estado programado y revisión. Se excluyen notas, respuestas y criterios privados; los excesos se rechazan sin truncar.
- Video SDK sincroniza salas por user_key firmado. Participantes sin conexión quedan pendientes; visitas esperan confirmación y compensan errores. El plan excluye presencias vencidas/bloqueadas y devuelve al grupo principal a quien pierde asignación. Meeting conserva su operación anterior.
- La salida continua incorpora cámara local explícita y rótulo. Mezcla audio de videos sin retorno y lo transmite como pista local clonada a Video SDK. Capturar espera el audio anunciado; cambiarlo durante compartir está bloqueado. La cancelación libera cámara pendiente, pistas y conexiones.
- IndexedDB recupera textos y archivos por usuario/sesión, espera escrituras pendientes y nunca conserva permisos de captura o URLs. Una pantalla requiere vincularse otra vez.
- recordings:health informa configuración y, solo con --database, contadores de jobs. No imprime secretos ni confunde actividad histórica con worker vivo.

La migración canónica nueva es 20261103120000_live_studio_participation.sql de SOFIA/Learning. Sustituye la preparación local no recuperada del reporte antiguo; no depende de un archivo 20261024180000 ausente. Es aditiva/reentrante y conserva el núcleo previo privado. La migración Video existente sigue siendo requisito del proveedor.

## Verificación ejecutada

| Proyecto | Comando | Resultado |
| --- | --- | --- |
| Hub | npm run verify:pr | Adaptadores, arnés, suministro, documentación, semilla, OpenSpec, tooling, tipos, lint y suite aprobados. 529 archivos aprobados, 2 omitidos; 5987 pruebas aprobadas y 5 omitidas. |
| Hub | Pruebas focalizadas posteriores del bridge, salas y compartir | 10 aprobadas tras la última guarda de asignación. Incluyen espera de audio y liberación ante cancelación. |
| Hub | Pruebas de lifecycle de audio/cámara | 4 aprobadas; no se detiene la pista original y cerrar salida cancela la cámara pendiente. |
| Hub | npm run typecheck; npm run lint:changed; npm run docs:check; npm run docs:system:check | Repetidos tras ajustes; correctos. Sin deuda nueva. |
| Hub | npm run zoom:build | Tipos y bundle aislado correctos; aviso de tamaño de proveedor, sin relajar CSP. |
| Hub | node scripts/quality/smoke-zoom-runtime.mjs | SDK_READY_ORIGIN=soflia-zoom://meeting; VIDEO_ASSETS=true. |
| Hub | node scripts/quality/smoke-studio-program.mjs | PROGRAMA_CONTINUO_OK: video estable, mezcla/transporte de audio, overlay sintético, recuperación con escrituras pendientes y receptor aislado. |
| Learning | npm run test --workspace=apps/web -- src/features/live/__tests__ src/proxy/__tests__/api-route-auth.test.ts --maxWorkers=2 | 27 archivos, 171 pruebas aprobadas; SQL reentrante, roles, cadencia, deduplicación, revisión antigua, negociación HTTP y conservación legacy al instalar incluidos. |
| Learning | npx --no-install tsc --noEmit -p apps/web/tsconfig.recordings.json | Correcto tras next typegen local; no build ni variables remotas. |
| Learning | ESLint focalizado de servicios, contrato, ruta y pruebas | Correcto. |
| Engine | npm run typecheck | Correcto. |
| Engine | npm run test:course-delivery | 25 pruebas aprobadas, con regresión Nexus y privacidad de preparación. |
| Engine | npm run test:security-boundaries | Correcto. |
| Engine | docs:check y validación estricta del cambio nuevo | Correctos. |
| Engine | npm run verify:pr | Supera adaptadores, arnés, documentación, OpenSpec (34), tooling (20), lint global y tipos. Se detiene en architecture:cycles con 11 ciclos previos del compositor multimedia. No se declara gate global verde de Engine. |
| Ambos consumidores | Sincronizadores con LEARNING_CHECKOUT y --check | Contratos coincidentes con Learning. |

La suite general Hub empezó antes del último ajuste de espera de audio y autorización de salas. Esos archivos se volvieron a verificar con pruebas focalizadas, tipos/lint y smokes; no se repitió innecesariamente toda la suite.

## Revisión independiente

Un revisor de solo lectura intentó refutar permisos, idempotencia, aislamiento, recuperación y cancelación. Detectó y se corrigieron:

1. Nexus conservaba materiales antiguos y readiness no exigía sesiones: guardas en servicio/builder y regresión.
2. Conexión tardía a salas abiertas usaba mover en vez de asignar: elección basada en pertenencia real.
3. Visitas tardías podían desalinear audio/chat: exclusión de visitas concurrentes y compensación.
4. Recuperación adelantaba escrituras pendientes: lectura espera la cola de esa clave.
5. Cámara en preparación podía sobrevivir diez segundos al cierre: captura/AbortController se liberan inmediatamente.
6. Activar audio durante compartir no cambiaba la pista: controles y hook lo bloquean.
7. SDP aplicado no confirmaba transporte: se espera conexión y se observan fallos posteriores.
8. Compartir podía adelantarse a ICE: anuncio de preparación, espera con timeout y oferta fuera de la cola SDK evitan silencio y bloqueo circular.

El revisor confirmó cierre de sus hallazgos y no encontró otro P1/P2 concreto en las fronteras revisadas. La prueba nativa detectó uso de evaluación dinámica de Zod bajo CSP: se corrigió con validación jitless, conservando la política.

## Límites y activación

Con aprobación explícita del plan se aplicaron en Learning principal mrqnnmuckznvukjvfkly las migraciones Video SDK y participación: versiones remotas 20261103184110 y 20261103184120. Preflight, respaldo de la función previa, hashes, postflight y evidencia están en docs/reports/live-activation-2026-11-03/ del repositorio Learning. El historial remoto confirma la aplicación. Se conservaron una sesión programada en Meeting y un estado legacy, los dos buckets privados y Realtime. Las funciones son invoker y solo service_role puede ejecutarlas; las credenciales Video están vacías y aisladas por RLS.

No se contrataron planes, configuraron credenciales ni desplegaron servicios. El overlay nativo usa una fuente sintética; la cámara física, llamada real, salas reales, captura cloud, transferencia a Storage y reproducción requieren piloto. La configuración completa no acredita capacidad ni facturación.

Antes de activar: publicar Learning compatible sin pool mixto de backends tras la ampliación del estado, revisar/autorizar el esquema de autoría de Engine (sus tres tablas no existen en la base remota), configurar Video/archivo/conexión Engine, comprobar dos organizaciones y aulas simultáneas, revocación y reconexión, y grabación con Hub cerrado. La guarda SQL conserva el formato legacy hasta que escribe el nuevo backend y rechaza degradaciones posteriores. No se promete capacidad de 500 participantes. Intervenciones automáticas de Soflia en el grupo y RTMS/LTI/LRS conservan su alcance ampliado separado.

Continuación: el usuario ya aprobó la migración y verificaciones de Engine emsjctbdevufloxntjll. Su plan, preflight y postflight están en openspec/changes/complete-live-preparation-delivery/reports/ del repositorio Engine. Las siete funciones se prepararon como invoker con search_path vacío; aprobaron 14 pruebas SQL con rol de backend y denegación al navegador, además de las 25 pruebas del dominio. La ejecución remota sigue pendiente porque la conexión Supabase dejó de estar disponible; se solicitó su conexión. No pedir de nuevo la aprobación existente. Despliegue, configuración y piloto siguen pendientes.

Rollback: retirar entrega nueva y funciones de participación coordinadamente; conservar tablas, archivos y revisiones. Para nuevas aulas se puede volver al proveedor Meeting, manteniendo compatibilidad con aulas Video previas. No borrar material ni desactivar captura obligatoria como reversión.
