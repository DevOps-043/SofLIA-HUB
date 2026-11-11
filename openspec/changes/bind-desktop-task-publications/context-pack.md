# Contexto del cambio

- Objetivo: reducir deuda de aislamiento en publicaciones y aprendizaje Desktop.
- Actor: identidad main que inició una tarea; nunca usuario activo al terminar.
- Alcance: procedencia efímera de publicaciones de tareas, respuestas tardías,
  forwarding de backends, conservación de contexto en las tres colas y memoria.
- No objetivos: declarar aislados todos los historiales/cachés/perfiles ni arbitrar
  toda entrada física. Ese estado compartido necesita otro bloque y sigue pendiente.
- Contratos: DTO IPC/eventos y cuatro capas conservados; procedencia privada main
  no serializable, no tomada del modelo. Memoria usa snapshot admitido de evento.
- Riesgo/HITL: conservar autorizaciones existentes; ningún efecto GUI, cuentas,
  secrets/.env, índice, migraciones o dependencias. No ejecutar GUI/preview.
- Criterios: evento legítimo/forjado, logout/A/B/A/cancelación, mutación/reentrancia,
  tareas simultáneas/colas/backend sin scope, pruebas de servicio reales con puertos
  ficticios, suite con cobertura/build y hash estable.
- Incertidumbres: suprimir publicación no revierte I/O ni elimina mutaciones
  internas tardías. Config/caches/perfiles/eventos ajenos no se atribuyen a esta mejora.
- Aislamiento: rama vigente con unidades necesarias sin commit; backup del delta
  frente a unidad 44 y preservar índice ajeno. Revisión independiente pendiente.
