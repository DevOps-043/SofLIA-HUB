# Verificación del estudio del instructor

Fecha: 2026-10-11. Estado: frontend implementado; flujos y diseño verificados localmente.

La revisión vigente de modos, escenas precargadas y visita a salas tiene [su evidencia posterior](scenes-verification.md). Las secciones de abajo registran la construcción y refinamiento inicial del estudio.

## Revisión de densidad y quizzes

La revisión final conserva los contornos verdes pedidos por el usuario, adelgaza las barras, retira el texto decorativo inferior y agrupa crear/seleccionar quizzes en Material. A 1440 × 900 px el encabezado mide 54,5 px, la barra de medios 44 px, el editor 41 px y la lista de mensajes 348 px (panel de chat 511 px). La inspección se hizo con los campos enfocados y ambos temas; no se confunde el encabezado de la fixture con el encabezado del producto.

- `npx vitest run src/__tests__/components/InstructorStudio.test.tsx src/__tests__/components/SelectDropdown.test.tsx src/__tests__/components/LearningWorkspace.test.tsx src/__tests__/app/learning-room-routing.test.tsx --maxWorkers=4`: 19 pruebas aprobadas en cuatro archivos. [Registro focal](compact-focal-tests.log). Cubre límites/estado de los botones numéricos, selección de quiz como metadatos, creación desde Material y opciones del selector dentro del diálogo con teclado.
- `npm run verify:pr`: exitosa, 4038 pruebas aprobadas y una omitida, 379 archivos aprobados y uno omitido. También pasaron adaptadores, harness, cadena de suministro, documentación, semillas, OpenSpec, tipos y lint (196 archivos sin deuda nueva). [Registro de la compuerta](compact-gate.log). Los fallos intermitentes anteriores se conservan abajo como historial de la primera implementación.
- Chrome: se ajustó el reloj con botones, se eligió audio con flechas/Enter, se creó un quiz desde Material y se verificó el centrado del diálogo. Evidencia: [oscuro](studio-compact-dark.png), [claro](studio-compact-light.png), [audio](studio-compact-audio.png), [quiz](studio-compact-quiz.png), [chat móvil](studio-compact-mobile-chat.png), [material móvil](studio-compact-mobile-activities.png) y [quiz móvil](studio-compact-mobile-quiz.png). A 390 × 844 px no hubo desbordamiento y se conservaron los nombres accesibles de las acciones de medios.
- La selección de archivo mediante Computer Use quedó limitada por la extensión de Chrome, que no tiene acceso a URLs de archivos. No se cambió esa preferencia ni se acreditó una selección visual exitosa. El flujo local de metadatos fue verificado en la prueba automatizada; no existe subida al servidor ni importación de preguntas.
- Se reinició únicamente el servidor de esta fixture para resolver su caché de importación al añadir una hoja CSS. Se conserva la demo en el puerto 4320, con tema oscuro y tamaño normal restaurado. Sin cambios de credenciales, backend ni despliegue.

## Matriz de aceptación

| Criterio | Verificación |
| --- | --- |
| Instructor y participante separados según can_manage | Pruebas LearningWorkspace: instructor confirmado, participante y error con reintento |
| Chat propio, insignia instructor y moderación local | Pruebas de comandos, mensaje con chat restringido, restricción/bloqueo de usuarios |
| Estadísticas derivadas de los ejemplos | Prueba de participación; fixture con preguntas etiquetadas y autores de ejemplo |
| Salas por tamaño o cantidad | Prueba de distribución equilibrada, sin pérdida de participantes |
| Quiz y recursos | Pruebas de respuestas distintas y selección de metadatos sin subida |
| Relojes y medios | Pruebas de fin/limpieza del intervalo y selección persistente de audio; escenas en inspección visual |
| Tres columnas, ambos temas y ancho reducido | Inspección mediante Computer Use en Chrome |

## Evidencia

- `npx vitest run src/__tests__/components/InstructorStudio.test.tsx src/__tests__/components/LearningWorkspace.test.tsx src/__tests__/app/learning-room-routing.test.tsx`: 3 archivos y 12 pruebas exitosas.
- `npm run lint:changed`: 193 archivos revisados sin deuda nueva.
- `npm run typecheck`: exitoso.
- Primera ejecución de `npm run verify:pr`: exitosa, con 4035 pruebas aprobadas y una omitida. Se conserva el registro en `../gate.log`. Tras el último ajuste de especificidad CSS para móvil, la segunda ejecución aprobó adaptadores, harness, cadena de suministro, documentación, semillas, OpenSpec, tipos y lint; el conjunto de pruebas terminó con 4033 aprobadas, una omitida y tres tiempos de espera en archivos ajenos al cambio. El registro es [gate.log](gate.log).
- Se repitieron los tres archivos afectados con `npx vitest run electron/__tests__/background-teams.test.ts electron/__tests__/integrated-browser-agent-shortcuts.test.ts electron/__tests__/whatsapp-agent.test.ts --maxWorkers=3`: 93 pruebas aprobadas en 6,52 segundos, sin cambiar sus implementaciones. Registro: [retry-timeouts.log](retry-timeouts.log). El carácter intermitente bajo carga es una inferencia; no se atribuye al estudio ni se oculta el resultado de la compuerta.
- Repetición de la primera implementación con `npm run test -- --maxWorkers=4`: 4035 pruebas aprobadas, una omitida y un fallo de aserción en `integrated-browser-service.test.ts`, sobre `sensitiveHandoff` durante la captura. Registro: [tests-final.log](tests-final.log). Esa prueba pasó al ejecutarla sola con `--maxWorkers=1`; registro: [browser-test-isolated.log](browser-test-isolated.log). No se editaron el servicio ni su prueba para resolver este cambio. Esa repetición no estuvo totalmente verde; la compuerta de la revisión posterior sí pasó, según el registro de arriba.
- `npm run docs:check`: enlaces válidos en 441 archivos Markdown activos. `node --check test/manual/live-sessions/verify.cjs`: exitoso.
- OpenSpec estricto: 53 elementos válidos después de cerrar las tareas y actualizar el diseño.
- Inspección de Chrome mediante Computer Use: escribir con insignia del instructor, activar modo lectura y SofLIA, preparar seis salas, seleccionar entrada/salida de audio, preparar quiz con tres respuestas y cambiar escena Cámara/Combinada. Se guardaron [audio](studio-audio.png), [quiz](studio-quiz.png) y [cámara](studio-camera.png).
- Diseño inspeccionado a 1440 × 900 px en [tema oscuro](studio-dark.png) y [tema claro](studio-light.png). A 390 × 844 px se comprobó una sola área visible: [transmisión](studio-mobile.png), [chat](studio-mobile-chat.png) y [actividades](studio-mobile-activities.png), sin desbordamiento horizontal. La primera inspección detectó una colisión de especificidad CSS que apilaba áreas; se corrigió y se verificó la exclusión por estilos computados y capturas.
- El selector exclusivo de la fixture confirmó la [vista separada del participante](participant-separate.png), sin estudio ni herramientas del instructor. Se restauró el tamaño normal del navegador y se dejó la demo en el estudio oscuro. Sin errores de consola observados.
- `git diff --check` de los archivos del cambio: sin errores. La fixture del participante se adaptó al nuevo ingreso directo del estudio; su script se conserva para reproducción y no se ejecutó en esta revisión visual.

## Límites

El estudio es un prototipo de frontend. No envía mensajes ni comandos de moderación, no crea salas Zoom, no publica quizzes o recursos y no pide acceso a cámara/micrófono/pantalla. Los relojes funcionan localmente. La revisión posterior permite medios locales en las escenas y visitas de diseño a salas, según la evidencia enlazada arriba. La aplicación obtiene el rol de una lectura autorizada existente; la fixture se abre sin cuentas con ejemplos explícitos y un selector visual de roles. El participante conserva el lienzo vacío y queda pendiente su diseño.

La vista previa se reproduce con `npx vite --config test/manual/live-sessions/vite.config.mts` en el puerto 4320. Las capturas de Chrome acreditan la composición React; no equivalen a una verificación multimedia o de Electron empaquetado. No se modificaron credenciales, backend ni despliegues.
