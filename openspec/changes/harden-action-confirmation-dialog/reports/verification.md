# Verificación de confirmaciones de acciones

Estado: implementación con verificación parcial. Fecha: 2026-10-25.

## Cambio y alcance

El diálogo del chat ahora abre con modalidad nativa, nombre asociado y foco en
Cancelar o en el título si requiere scroll. Escape cancela y cerrar restaura el
invocador conectado. Los botones no envían formularios, los atajos por burbujeo
quedan contenidos y el contenido extenso respeta zoom y movimiento reducido.

El dueño asigna identidad efímera a cada revisión. Renovar sus nodos impide que
un gesto anterior decida sobre otra solicitud idéntica. ChatModals conserva el
resolver capturado sin limpiar unilateralmente la revisión actual. Se mantienen
guardas y permisos, main/preload/renderer y dependencias. El arnés renderer de
preparación aislada se comparte con el selector existente.

## Regresiones y pruebas dirigidas

Evidencia local en `%TEMP%/soflia-confirmation-dialog-2026-10-25/`:

- `renderer-valid-red.log`: 18 fallos y 4 aprobadas con la versión previa; el
  primer intento inválido por falta de showModal en jsdom no acredita regresión.
- `restore-red.log`: falla retorno al invocador al confiar sólo en close.
- `gesture-renderer-red.log`: falla aislamiento del gesto previo al reemplazar
  solicitud. La prueba nativa también reprodujo ese fallo.
- `renderer-adversarial.log`: 26 pruebas aprobadas de componente y consumidor.
  Los dobles jsdom sólo modelan ciclo de diálogo; no simulan modalidad real.
- `tests-contract-final.log`: 72 pruebas aprobadas en seis suites, incluyendo
  servicios de confirmación y seguridad y contratos IPC consumidores existentes.

Son 24 casos renderer adicionales respecto de la unidad 29. No equivalen a un
porcentaje de cobertura, accesibilidad ni reducción global de deuda.

## Resultados nativos anteriores a la limitación visual

`native-final.log`, perfil temporal `pulse-app-build-vZ5b2N`, registra diez
comprobaciones funcionales aprobadas: modalidad/fondo/AX, Tab, nueva identidad,
Escape/retorno, decisiones Enter/Space sin submit, opción permanente condicionada,
arrastre/fondo, gesto anterior de ratón/Space, contraste y lectura a 200% con
movimiento reducido. Foco emulado en Electron Windows/x64 sobre datos ficticios;
no cuenta, shell, lector de pantalla ni arranque completo del producto.

Las doce mediciones de contraste computado (tres variantes, dos temas y dos
estados) tienen mínimo 4.76989:1; hover se fuerza como estado CSS y su fondo
difiere del reposo. Los tonos anteriores fallaban 4.5:1 en reposo. Se conservaron
familias cromáticas y etiquetas usando tonos existentes de Tailwind.

`selector-frozen-final.log`, perfil `pulse-app-build-kM34xi`, registra seis
comprobaciones del selector después de compartir el arnés. Los hashes y recibos
de [evidencia nativa](native-summary.json) distinguen las fuentes actuales del
componente, consumidor y dependencias (13 coincidencias) de los dos archivos del
fixture modificados después. El consumidor se ejecuta en pruebas renderer, no
en la escena nativa del componente. Se guardan además las
[regresiones previas](regression-summary.json), incluido contraste insuficiente.

## Limitación gráfica y tareas pendientes

Las imágenes del primer resultado funcional estaban vacías o desactualizadas;
no se usan como evidencia visual aprobada. Las sondas gráficas posteriores
detectaron fondos sin tarjeta, timeouts y fallos de foco; se conservan logs y no
se atribuye una causa no demostrada. Se retiró ese código experimental del arnés.
La versión final simplificada del fixture nativo aún no se ejecutó.

La revisión automática rechazó abrir el archivo local con la herramienta de
navegador: sólo admite HTTP/HTTPS y no concedió acceso al archivo. No se cambió
de superficie ni se sirvió el archivo por otra vía para eludir el rechazo. La
revisión visual queda pendiente. Otras plataformas, CI Node 24, auditoría AT y
revisión independiente siguen pendientes; el cambio no se archiva.

## Autorrevisión adversarial

Se intentó refutar propiedad de resolución ante callbacks obsoletos, gestos
iniciados en otra solicitud, reapertura/StrictMode, invocador retirado,
contenido largo y cambios de alternativas, cancelación, envío accidental de
formulario y contraste de hover. Se corrigieron el borrado redundante del estado,
la reutilización de controles, el retorno de foco y contraste insuficiente.
La extracción del arnés conserva fixtures allowlisted, rutas temporales propias,
entorno permitido y bloqueo de red. No incorpora herramientas de desarrollo al
runtime. Esta autorrevisión no sustituye revisión independiente.

## Gate y build finales

`npm run verify:pr` terminó con código 0 en 357.10 s, con sus trece etapas:

- Vitest: 5,866 aprobadas y 5 omitidas; 508 archivos aprobados y 2 omitidos.
- Tooling Node: 48 aprobadas. Python 3.12.11: 33 aprobadas, con el intérprete
  aislado señalado por `SOFLIA_TEST_PYTHON`.
- Typecheck, harness, especificaciones y validaciones documentales aprobados.
- Lint incremental: 393 archivos sin deuda nueva respecto de su base histórica.
- Enlaces válidos en 758 Markdown activos; inventario derivado de 688 archivos
  de prueba. Es un inventario de archivos, distinto de las suites ejecutadas.

`npm run app:smoke:build` terminó con código 0 en 82.68 s. Su temporal propio
`pulse-app-build-mAPqR8` conserva seis artefactos no vacíos, sin copiar `.env`,
empaquetar instalador ni arrancar el producto. Enumera 3,481 rutas Git y copia
3,480 fuentes existentes cuyos hashes coinciden. La diferencia es la eliminación
local preexistente `electron/wa-agent/bulk-label-verification.ts`, que se conserva.
Persisten avisos de tamaño de chunks e imports dinámicos inefectivos; el éxito
del build no declara resuelta esa deuda.

Las 3,500 fuentes del manifiesto ampliado permanecieron idénticas antes/después
de ambas ejecuciones. SHA-256 del manifiesto:
`85f9e77b95cffeeec6bd43af41a689a230609b06e3221438fb33645fbdb8cea6`.
Frente a la unidad 29 hay ocho fuentes modificadas y seis nuevas. La rama
acumulativa y los cambios ajenos se preservan, sin commit, push ni despliegue.

Recibos: [gate](gate-summary.json), [build](build-summary.json),
[fuentes y diferencias](source-evidence.json), [logs y hashes](log-evidence.json).
Comandos completos en `gate-final.log` y `build-final.log` del temporal indicado.
Ejecución local Node 26.7.0/Electron 44.9.3; no acredita CI Node 24 ni otras
plataformas. La actualización final sólo añade documentación/recibos y se
verifica por separado, sin repetir pruebas del producto sin cambios.

No hubo nueva auditoría npm ni una auditoría comparable del índice global;
estos resultados no producen otro porcentaje de deuda técnica.
