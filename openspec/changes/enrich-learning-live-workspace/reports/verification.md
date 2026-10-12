# Verificación de la entrega local V2

Fecha: 2026-10-10. Estado: aula colaborativa implementada localmente; integración externa y piloto pendientes. Rama Hub: `codex/browser-ecosystem-sso`. Rama Learning: `codex/learning-live-hub`.

Se trabajó sobre las ramas existentes porque la integración base todavía estaba sin commit y la entrega la utiliza. No se limpiaron ni movieron cambios ajenos. No se crearon commits ni se publicó software. No se cambió `.env`, secretos ni datos remotos. La CLI Supabase 2.120.0 creó el archivo de migración; su SQL se ejecutó únicamente en PGlite durante pruebas.

## Evidencia automatizada

| Comando | Resultado |
|---|---|
| Hub `npm run verify:pr` | Aprobado: adaptadores, arnés, suministro, documentación, semilla, OpenSpec, tipos, lint incremental y suite. 352 archivos aprobados y uno omitido; 3748 pruebas aprobadas y una omitida. |
| Hub `npm run typecheck` | Aprobado, main y renderer. |
| Hub `npm run lint:changed` | 51 archivos revisados, sin deuda nueva. |
| Hub `npm run openspec:validate` | 43 cambios válidos. |
| Hub `npm run docs:check` / `docs:system:check` | Aprobados. Inventario derivado sincronizado. |
| Hub `node scripts/quality/sync-learning-workspace-contract.mjs --check` | Contrato igual al productor Learning. |
| Hub suite focalizada Learning/Workspace | 5 archivos, 26 pruebas aprobadas. Incluye protocolo/transporte, preload, antesala, logout y UUID de reintento. |
| Learning `npm run test -- src/features/live src/proxy/__tests__/live-access-rate-limit.test.ts` desde `apps/web` | 10 archivos, 50 pruebas aprobadas. |
| Learning `npx tsc --noEmit -p tsconfig.typecheck.live-workspace.json` | Aprobado, APIs nuevas y dependencias reales. |
| Learning ESLint en archivos nuevos de contrato/servicio/API/SQL-tests | Aprobado. |
| Learning `npm run type-check --workspace=apps/web` | Core aprobado; app global bloqueada por errores fuera de Live. |
| Learning `type-check:features` | 7 errores fuera del módulo Live (componentes existentes de Core/admin/landing/LIA), ninguno en Live. No se amplió ni ocultó la configuración global para obtener un resultado verde. |

La compuerta primero señaló inventario desactualizado al agregar pruebas; se sincronizó mediante el script canónico y la compuerta completa se repitió con éxito. Advertencias existentes de Vitest/Vite y localStorage no representan fallos de estas pruebas.

## Revisión adversarial y visual

Se comprobaron actores de otra organización, asignación cancelada, cuenta suspendida, organización inactiva, alumno intentando administrar, grants directos anon/authenticated, payload ajeno a IPC, destinos manipulados, respuesta malformada y logout durante petición.

Se probaron publicación repetida/concurrente, conflicto al reutilizar UUID, votos duplicados, respuesta fuera de rango, intento de cambiar respuesta, pulse cerrado, autorrevisión, revocación durante IA, invalidación por versión de política, fuentes IA autorizadas y eliminación por retención. La revisión añadió locks compartidos de política, índices de FK/revocación y bloqueo de nuevas mutaciones mientras hay resultado incierto.

La UI real se renderizó en navegador local con fixture sintética explícita: antesala de alumno, controles de instructor, Pulse Checks y gobierno. Distribución legible a 1280×720; el panel participa del layout y no se superpone al espacio derecho. La captura quedó fuera del repositorio en el directorio de visualizaciones de esta conversación. Se cerraron pestaña/servidor y se retiraron los tres archivos temporales de preview. Esta prueba no acredita un WebContentsView real ni multimedia Zoom.

## Límites de la evidencia

No se efectuaron reuniones/webinars reales, llamadas a un LLM de producción, RTMS, LTI, exportación LRS, Computer Use sobre sistemas empresariales ni envíos corporativos. No se aplicó migración remota ni se configuró la purga del servidor. Los casos externos permanecen abiertos en tareas y en la documentación Learning; no se considera cerrada toda la propuesta V2.

Antes de habilitar en producción: aplicar migración y coordinar versiones, configurar el job de retención, verificar scopes/cuentas Zoom y realizar el piloto con instructor, alumnos y dos organizaciones. No hay medición de carga ni afirmación de certificación ISO 27001.
