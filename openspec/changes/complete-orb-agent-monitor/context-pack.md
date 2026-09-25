# Context Pack

- Objetivo: completar observación multiagente desde la Orbe y actualizar investigación de Codex.
- Usuario/actor: usuario autenticado de SofLIA que utiliza la Orbe por voz.
- Alcance: publicación de metadatos, identidad de sesión, autorización de ventana y documentación.
- No objetivos: contenido conversacional en el monitor, nuevos proveedores, permisos o herramientas.
- Restricciones: cuatro capas IPC existentes, español, sin secretos ni efectos externos.
- Contratos afectados: AgentActivity agrega orb; initializeAgentRuntime recibe getOrbWindow; puente existente conserva métodos y payload.
- Riesgo/HITL: riesgo medio por frontera IPC; las operaciones observadas conservan sus guardas y aprobaciones.
- Criterios verificables: Orbe autorizada visible; subframes, ventanas ajenas y usuario anterior rechazados; mismo UUID entre Hub/Orbe aislado; etiqueta Orbe visible; propietario capturado al iniciar turno.
- Incertidumbres: no se valida inferencia real ni tiempos del proveedor; la investigación upstream es estática y no ejecuta su código.
