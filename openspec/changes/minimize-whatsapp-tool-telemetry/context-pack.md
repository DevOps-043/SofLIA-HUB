# Contexto

- Objetivo: minimizar telemetría de herramientas WhatsApp sin perder detección de ciclos, avances parciales ni resultados entregados al modelo.
- Evidencia: agent-loop-tool-execution persiste toolSignature con argumentos JSON y summary con mensajes/errores/IDs. history.ts acepta metadata arbitraria, incluso en tool, y devuelve registros heredados sin filtrar. Dispatcher/fallback registran o devuelven excepciones crudas.
- Alcance: proyección de eventos kind:tool en productor y store, lectura segura de tool legacy sin reescritura, resumen tipado de estados/contadores, firmas opacas efímeras, excepciones inesperadas del loop/fallback/guardas saneadas y correlación.
- No objetivos: cifrar/migrar todo el historial, borrar registros existentes, rediseñar conversación/mensajes ni sanear cada respuesta normal de todos los servicios. Identificadores de contacto y texto de eventos no-tool siguen bajo su política actual.
- Criterios: ni argumentos ni mensajes/errores privados en nuevos eventos tool o su lectura pública; mantener éxito/parcial/uncertain/cancelled/progreso; huellas por turno distinguen datos relevantes sin texto en trace; un fallo del registro no repite efectos; dispatcher continúa tras excepción con error público y referencia, sin payload.
- Restricciones: conservar ocho unidades previas, módulos/permisos/HITL, APIs posicionales, sólo disco temporal y servicios simulados. Sin .env, perfiles reales ni llamadas remotas.
- Límites: legado físico sigue intacto; la proyección al leer no lo cifra. Respuestas normales del dominio al modelo conservan contenido necesario y requieren revisión de cada servicio por separado.
