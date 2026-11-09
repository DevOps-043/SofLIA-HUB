# Autorrevisión adversarial

Estado: revisión local del autor, 2026-10-22. No sustituye revisión independiente.

Se contrastaron propuesta, diseño, especificación, módulo, integración del servicio,
regresiones y harness nativo, preservando las nueve unidades anteriores.

| Hipótesis intentada | Evidencia y resultado |
|---|---|
| Presión suspende audio, captura, carga o DevTools | Cuatro casos rojos antes de implementar. Cinco casos del servicio aprobados después, incluida carga principal. El puerto de trabajo consulta las mismas seis condiciones nativas y de estado en ambas vías. |
| Protección bloquea para siempre el presupuesto | Caso de exceso con candidatas protegidas y trabajo que cesa: el retry recupera el objetivo y publica el cambio. Ocho es objetivo, no límite duro. |
| Una nueva solicitud posterga el vencimiento cercano | Caso de gracia próxima más nuevo presupuesto: conserva un único timer y evalúa en el primer vencimiento. |
| Callback viejo consulta o destruye vistas de otro perfil | Callbacks retenidos después de stop y después de nuevo reconcile no consultan el estado nuevo. Stop durante retirada/error no rearma el timer. |
| Un error periódico expone una URL o queda sin manejar | El puerto recibe aviso sin argumentos. El servicio registra texto fijo sin excepción ni URL y programa retry. Los callers síncronos propagan el error. |
| Retirada parcial desaparece si después falla throttling | Se añadió revisión de retiradas y publicación sin reconciliación recursiva; caso con retirada completada y fallo posterior aprueba sin repetir la retirada. |
| Se pierde restauración, split o ventanas separadas | 279 casos dirigidos incluyen las regresiones previas del servicio/checkpoint. Ocho comprobaciones con Electron real temporal incluyen snapshot, cierre nativo, rematerialización y el lifecycle previo. |
| La extracción cambia contratos o procesos | Comparación AST: 144 firmas públicas iguales a HEAD. El módulo no importa Electron; vistas/snapshot/perfil permanecen en main. No cambia IPC, renderer, persistencia ni dependencias. |
| Un verde se obtiene ocultando deuda | Lint incremental: 142 archivos sin deuda nueva; no se amplió baseline. Inventario documental derivado: 630 archivos. Gate completo registrado en verification, sin desactivar casos. |

Límites: no se probó audio/captura real ni formularios arbitrarios. El smoke usa
actividad simulada y contenido local sobre vistas reales. No hay medición de
RAM/CPU, smoke del instalador ni cuentas reales. Un consumidor de eventos que
lanza errores no tiene entrega garantizada; el callback registra el fallo sin
volver a ejecutar retiradas completadas. El coordinador conserva otras áreas
por separar. No se recalcula el porcentaje global ni se archiva sin revisión
independiente.
