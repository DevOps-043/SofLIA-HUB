## 1. Línea base y contratos

- [x] 1.1 Añadir pruebas que reproduzcan throttling, pestañas protegidas, suspensión/restauración y ausencia de polling perpetuo.
- [x] 1.2 Añadir agregación pura de métricas Electron y cubrir unidades, tipos desconocidos y redacción de datos.

## 2. Prioridad y memoria de pestañas

- [x] 2.1 Implementar reconciliación dinámica de `backgroundThrottling` para superficies visibles, ocultas, separadas y control del agente.
- [x] 2.2 Implementar un único scheduler de pestañas frías con periodo de gracia, un respaldo caliente y protecciones de carga/audio/captura/DevTools.
- [x] 2.3 Integrar la política con creación, activación, layout, foco, ocultación, ventanas separadas y cleanup idempotente.

## 3. CPU y observabilidad

- [x] 3.1 Convertir la percepción pasiva en captura dirigida por eventos sin reprogramación indefinida, preservando observación explícita.
- [x] 3.2 Añadir monitor opt-in `--resource-diagnostics` sobre `app.getAppMetrics()` con intervalo acotado y `dispose()`.
- [x] 3.3 Añadir comando/guía de benchmark reproducible de tres pestañas y registrar evidencia antes/después disponible en el host.

## 4. Documentación y verificación

- [x] 4.1 Actualizar parámetros de runtime y arquitectura con presupuestos, protecciones, limitaciones y rollback.
- [x] 4.2 Ejecutar pruebas dirigidas, typecheck, lint cambiado, documentación, OpenSpec y `verify:pr`; registrar excepciones reales.
- [x] 4.3 Ejecutar revisión adversarial de pérdida de estado, pestañas con medios, carreras de timers, cleanup, métricas y regresión de fluidez.
