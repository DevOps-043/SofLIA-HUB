# Barra compacta y arrastre

Estado: implementado y verificado localmente; cambio activo sin archivar.

## Resultado

- Cabecera de 28 px frente a 48 px y ancho de 380 px frente a 460 px. Sin logo, título ni texto de Nuevo chat en la cabecera: asa, +, selector de modelos y minimizar con nombres accesibles.
- Campo vacío de 28 px; apertura con ratón sin foco automático ni halo de escritura. La apertura mediante teclado conserva el foco útil.
- Arrastre con Pointer Events/captura y movimiento mediante flechas (12 px; Shift: 32 px). Posición y borrador se conservan al minimizar; los límites se recalculan al redimensionar, crecer el contenido y abrir modelos. Perder captura o foco cancela el arrastre.
- Estado sin selección de proyecto como entrada compacta accionable: prepara el destino autorizado antes de ofrecer envío. La entrada y + comparten una creación pendiente para impedir duplicados.
- Integración del navegador sin canales nuevos: el renderer calcula el mayor rectángulo operable que no cruza el panel. Se admite inset superior en IntegratedBrowserPanel; setViewport conserva su contrato existente. Durante arrastre o sin región disponible en ventanas pequeñas se utiliza la guarda de overlays existente para retirar temporalmente la superficie nativa, sin cerrar la pestaña.

## Verificación

- Línea base: 34 pruebas correctas en los cuatro archivos iniciales del área.
- Pruebas focalizadas ampliadas: 108 correctas en seis archivos antes del último caso de concurrencia. Incluyen límites, región nativa sin intersección, teclado, borrador, foco de reposo, preparación por proyecto y actualización del inset superior.
- TypeScript correcto durante implementación; lint incremental correcto después de retirar una memoización incompatible con React Compiler. No se añadieron excepciones de lint.
- `node test/manual/floating-chat/smoke.mjs`: correcto en Electron con compositor real y controlador simulado. Comprueba tamaño máximo de 76 px en reposo, arrastre real por ratón, restauración tras perder foco, conservación de posición/borrador, selector, reposo sin selección y resize a 420×360.
- Capturas inspeccionadas: [reposo oscuro](compact-drag/barra-delgada-oscuro.png), [arrastrado](compact-drag/chat-arrastrado.png), [modelos](compact-drag/modelos-compactos.png), [sin selección](compact-drag/reposo-sin-seleccion.png) y [compacto claro](compact-drag/barra-compacta-claro.png).
- [Detalle de la barra](compact-drag/barra-detalle.png) capturado directamente por región de WebContents. El smoke final también verifica por hit testing que el asa permanece por encima de una barra de nivel 50 al arrastrar hasta arriba; dock en nivel 60, por debajo de los menús globales y diálogos nativos.
- El caso de creación simultánea pasó en `FloatingAppWorkspace.test.tsx`: seis pruebas correctas después de añadir la exclusión por ámbito.
- Primera compuerta detenida por inventario documental derivado desactualizado: regenerado con `npm run docs:inventory:sync`. La siguiente compuerta pasó con 525 archivos correctos, dos omitidos, 5969 pruebas correctas y cinco omitidas. Tras corregir el último detalle de superposición se repite sobre el estado final; no se omiten ni amplían baselines.
- `npm run verify:pr` final: correcto. 525 archivos correctos y dos omitidos; 5969 pruebas correctas y cinco omitidas, sin fallos. Pasaron adaptadores, arnés, cadena de suministro, documentación del sistema/enlaces, semilla de skills, OpenSpec, pruebas de calidad, TypeScript y lint incremental. Salida completa fuera del repositorio en `%TEMP%/soflia-floating-compact-verify-pr-final.log`.

## Revisión y límites

Se revisaron pérdida de captura/foco, panel fuera de pantalla, crecimiento del historial, colisión con WebContentsView, creación doble y envío sin destino. Se preservan permisos, cancelación y aislamiento por ámbito existentes; no cambia el runtime ni su catálogo de herramientas.

El arrastre permanece dentro de la superficie de la aplicación, no crea una ventana del sistema operativo. WebContentsView sólo permite un rectángulo: después de mover el panel puede reducirse la región operable de la página. La fixture visual no utiliza un WebContentsView ni proveedores reales; su geometría se comprueba con pruebas de integración y funciones de disposición. No se afirma QA nativo sobre una página remota con sesión real.

Reversión: retirar el refinamiento de presentación/posición y el inset superior renderer; no hay migraciones, efectos remotos ni datos por revertir. Se conservó el trabajo previo del worktree sin resets ni commits mezclados.
