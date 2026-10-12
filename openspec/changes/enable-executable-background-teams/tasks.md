# Plan de implementación

Estado: fase local implementada y comprobada; nuevas fases pendientes. Las fases son incrementos técnicos, no estimaciones de calendario.

## 0. Propuesta

- [x] 0.1 Inspeccionar selección, ejecución, herramientas, persistencia y monitor actuales.
- [x] 0.2 Investigar Work/ChatGPT y Claude mediante documentación oficial vigente.
- [x] 0.3 Definir contexto, decisiones, alcance y escenarios de aceptación.
- [x] 0.4 Registrar validación documental de esta propuesta.

## 1. Trabajos locales ejecutables

- [x] 1.1 Inventariar servicios invocables desde main, permisos y exportadores; confirmar dos perfiles que puedan completar el caso piloto.
- [x] 1.2 Fijar contratos de trabajo, subtarea, artefacto y evento; validar identidad/organización en el host y límites de payload.
- [x] 1.3 Implementar repositorio cifrado con escritura atómica, retención y puntos de recuperación; no aceptar fallback a texto plano.
- [x] 1.4 Implementar cola acotada y ejecución independiente del renderer; devolver job ID tras guardar la admisión.
- [x] 1.5 Crear adaptadores de proveedor con ciclo de herramientas por agente, cuotas, presupuesto conjunto, timeout y cancelación.
- [x] 1.6 Adaptar herramientas de investigación y creación local al alcance de tarea y carpeta por agente; bloquear escapes de ruta y fuentes no autorizadas.
- [x] 1.7 Verificar archivos producidos y enlazar el resultado al chat de origen; conservar resultados parciales.
- [x] 1.8 Integrar cuatro capas IPC y monitor flotante con actividad real, controles y reconexión a snapshot.
- [x] 1.9 Cubrir conversación simultánea, trabajo mayor a 15 segundos, cambio de usuario, cancelación tardía y recuperación segura.
- [ ] 1.10 Probar el piloto en chat real con herramientas y archivos; actualizar manual, parámetros, contratos y evidencia. Obtener revisión independiente antes de archivar la implementación.

## 2. Coordinación y operaciones

- [ ] 2.1 Añadir dependencias y replanteamiento acotado, referencias versionadas y mensajes estructurados entre coordinador y ejecutores.
- [ ] 2.2 Implementar exclusión de archivo/documento/pantalla, generaciones de reserva y detección de ediciones del usuario.
- [ ] 2.3 Añadir perfiles documentales disponibles y verificación de formatos y cálculos; integrar nuevos exportadores tipados si faltan.
- [ ] 2.4 Integrar servicios externos con aprobación del payload final, caducidad, registro de intención/recibo e idempotencia disponible.
- [ ] 2.5 Probar pérdida de respuesta tras efectos, ausencia de cifrado, herramientas no disponibles y recuperación sin duplicados.
- [ ] 2.6 Evaluar equipos de dos a cuatro agentes frente a uno: cumplimiento, calidad, latencia, consumo e incidencias; fijar límites con evidencia.
- [ ] 2.7 Ampliar superficies con sus políticas existentes, despliegue gradual y revisión independiente.

## 3. Continuidad ampliada

- [ ] 3.1 Diseñar programación por tiempo/eventos bajo solicitud expresa, caducidad de autoridad y avisos por cambios relevantes.
- [ ] 3.2 Definir host remoto, identidad, almacenamiento, retención y presupuestos; decidir alojamiento con evidencia de necesidades.
- [ ] 3.3 Implementar ejecución remota solo para herramientas y recursos compatibles; puente local autenticado para los demás.
- [ ] 3.4 Probar equipo apagado, recurso local ausente, revocación, aprobación pendiente y ausencia de envío automático de carpetas.
- [ ] 3.5 Documentar capacidades efectivas por entorno y recuperar errores sin prometer disponibilidad indefinida.
