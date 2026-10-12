# Contexto del cambio

- Objetivo: SofLIA se mueve y señala el objetivo sin arrastre del usuario.
- Usuario o actor: usuario autenticado de escritorio; instructor que prepara una práctica local.
- Alcance: movimiento, señalización, Computer Use, práctica local y pruebas de fronteras.
- No objetivos: transmisión multimedia, control remoto de alumnos, migraciones o publicación.
- Restricciones: conservar aprobaciones, coordenadas vinculadas a la captura, posición de descanso y foco de la aplicación.
- Contratos afectados: guía main, IPC/preload/wrapper, acción de escritorio, controlador visual y práctica semántica.
- Riesgo y HITL: el acompañamiento no autoriza acciones de entrada; las guardas de Computer Use siguen vigentes.
- Criterios verificables: señales antes del clic; pausa detiene nuevas acciones; cancelación libera esperas; captura limpia; rechazo de emisor ajeno; prueba multimonitor con coordenadas negativas.
- Incertidumbres: composición de ventanas transparentes y transmisión en hardware real; compatibilidad del objetivo con UIA/OCR.
