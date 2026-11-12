# Contexto del cambio

- Objetivo: sustituir la representación WebGL por el avatar 2D aprobado, conservando voz, asistencia y ventana flotante.
- Actor: usuario del modo voz e instalador.
- Alcance: composición raster con transparencia, mirada 2D expresiva, catorce expresiones, rostro independiente, articulación acústica, audio existente, demostración y exportaciones derivadas.
- No objetivos: modelos 3D, Blender, nuevos canales IPC, permisos, proveedor de voz, reconstrucción de caras ocultas o rediseño del personaje.
- Restricciones: conservar cuerpo, bandas, logo, reflejos e indicadores de la primera imagen adjunta; preservar trabajo ajeno.
- Contratos: OrbCanvas mantiene visualState/audio/motionEnabled; acting se representa como focused. El componente SofliaAvatar ofrece controles tipados independientes del agente.
- Riesgo y HITL: cambio visual reversible, sin escritura externa ni captura nueva de micrófono. La extracción de capas requiere QA visual en claro y oscuro.
- Criterios: mirada normalizada limitada y suave desde toda la ventana; estados prioritarios; audio real por refs; pausa por visibilidad y movimiento reducido; liberación de recursos; PNG/SVG/GIF/WebM y fixture funcional.
- Incertidumbres: la fuente es una imagen aplanada; no contiene píxeles tras los ojos. Se reutilizan muestras oscuras del propio visor, se conserva el resto unido y se documenta la extracción. No se promete separar bandas estructurales ni reconstruir superficies ocultas.
