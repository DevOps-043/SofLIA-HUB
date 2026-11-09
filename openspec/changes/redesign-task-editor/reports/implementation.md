# Editor modal de tareas

Estado: implementado localmente y verificado; cambio activo sin archivar.

## Resultado

- Creación y detalle en ProjectDialog, sin insertar el formulario en el flujo del tablero. Disposición de dos columnas y una columna en pantallas pequeñas, acciones visibles, Escape y restauración de foco.
- Siete fases y estados personalizados compartidos con el tablero. Resolver main reutiliza IDs reales; materializar una fase requiere administración del equipo o workspace y la confirmación vigente de la tarea. Pendientes conserva un estado independiente con tipo persistido todo.
- Inicio en started_at y recursos foto/documento/web/chat del equipo en external_links. La tarea y sus referencias se guardan en la misma fila; son enlaces HTTP(S), no cargas de archivos ni envío de mensajes.
- Fechas y URLs validadas en renderer/main, parámetros sensibles retirados, hasta 50 referencias, errores conservan el borrador y resultados inciertos impiden repetir. Formatos heredados desconocidos se conservan al editar otros campos.

## Evidencia

- Línea base anterior al cambio: 64 pruebas dirigidas correctas.
- Última ejecución focalizada: `npx vitest run src/__tests__/components/ProjectManagement.test.tsx src/__tests__/components/TaskBoard.test.tsx electron/__tests__/project-direct-database.test.ts electron/__tests__/project-hub-bridge.test.ts`: 132 pruebas correctas en cuatro archivos.
- `npm run typecheck`: correcto tras las correcciones finales.
- `npm run harness:validate`, `npm run docs:check`, `npm run lint:changed`: correctos; lint incremental sin deuda nueva.
- `node test/manual/task-editor/smoke.mjs`: correcto en Electron con datos simulados. Modal nativo, tablero inmóvil, siete estados seleccionables, campos de inicio/recursos, edición, Escape, foco, temas y 390 px. Capturas: [oscuro](editor-oscuro.png), [estados](editor-estados-oscuro.png), [claro](editor-claro.png) y [compacto](editor-compacto.png). Inspección visual realizada.
- Primera compuerta completa: 523 archivos correctos, dos omitidos y un fallo en una prueba nueva por acumulación del historial de un mock. Corregido con limpieza del historial en beforeEach y comprobado en las 132 pruebas focalizadas. Se repite la compuerta completa sobre el código final.
- `npm run verify:pr` sobre el código final: correcto. Adaptadores, arnés, supply chain, documentación del sistema/enlaces, semilla de skills, OpenSpec estricto (101 elementos), pruebas de calidad, TypeScript y lint incremental correctos. Suite: 524 archivos correctos y dos omitidos; 5954 pruebas correctas y cinco omitidas, sin fallos. Salida completa fuera del repositorio en `%TEMP%/soflia-task-editor-verify-pr-final.log`.

## Revisión adversarial

Hipótesis comprobadas: un propietario de proyecto podría crear estados en un equipo ajeno; consultar opciones podría escribir; una URL malformada podría lanzar excepción en safeParse; un cambio parcial podría aceptar fechas invertidas; editar otro campo podría borrar referencias heredadas; el diálogo nativo podría robar foco al título; una URL podría guardar parámetros sensibles. Las pruebas negativas y smoke cubren estos casos. Corregidos safeParse, foco inicial, recuperación de opciones dentro del modal y conservación de datos heredados.

## Límites y reversión

No se aplicó SQL, no hubo mutaciones remotas ni se comprobaron permisos del proveedor con cuentas reales. Se reutilizan columnas existentes de IRIS y cuatro capas IPC existentes. Las fases nuevas se guardan antes de la tarea: un fallo posterior puede dejar una fase vacía reutilizable; no se borran estados compartidos automáticamente. Revertir el editor/contratos opcionales conserva datos existentes.

La rama es codex/task-editor-modal. Se preservó el trabajo previo sin commits mezclados, resets ni traslado de archivos. El cambio permanece activo, sin archivar.
