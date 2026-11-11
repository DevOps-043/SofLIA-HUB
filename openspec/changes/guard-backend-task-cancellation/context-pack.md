# Contexto del cambio

- Objetivo: impedir que una respuesta tardía del modelo inicie otra acción web/UIA tras cancelar; liberar estado incluso ante fallo de finalización.
- Actor: usuario autenticado que inicia/cancela Desktop Agent o cambia de sesión.
- Alcance: orquestación, decisiones, ejecutores compuestos y limpieza de BrowserWeb/WindowsUIA; tipado de las funciones afectadas.
- No objetivos: deshacer efectos iniciados, aislamiento global de perfiles/historiales, cancelar físicamente trabajo remoto o validar GUI real.
- Restricciones: preservar cuatro capas/HITL, DTO, colas, políticas de modelos y dependencias; sin secretos, cuentas ni GUI real.
- Contratos: señales internas opcionales y estados finales de tarea; no canales ni permisos nuevos.
- Riesgo: acciones de entrada ya iniciadas pueden aplicarse. La cancelación impide la siguiente llamada controlada, no revierte I/O.
- Criterios: revocar durante modelo/captura/acción compuesta impide pasos siguientes; cancelación no dispara fallback; inicio/finalización fallidos no dejan plazas bloqueadas; éxito conserva comportamiento.
- Incertidumbres: permisos/latencia del SO, motor remoto y operaciones indivisibles conservan validación separada.
