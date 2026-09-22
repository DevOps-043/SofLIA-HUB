# Contexto del cambio

- Objetivo: ejecutar y revisar análisis multiagente desde Meeting Ops.
- Actor: usuario autenticado propietario de la ejecución.
- Alcance: arnés, Codex/Gemini, herramientas de lectura, confirmación de borrador, persistencia y cuatro capas IPC.
- No objetivos: migraciones remotas, shell runtime, reemplazo de proveedores actuales o binarios redistribuidos.
- Restricciones: español, sesión en main, denegación por defecto y presupuesto acotado.
- Contratos: nuevos canales agent-runtime, tipos compartidos, estado cifrado local.
- Riesgo y HITL: creación de borrador solo tras decisión explícita ligada al digest.
- Criterios: dos especialistas y síntesis, cancelar sin nuevas etapas, sesión revocada sin efectos, aislamiento de herramientas, recuperación y no repetición de publicaciones inciertas.
- Incertidumbres: acceso real a modelos y autenticación Codex del usuario; se valida disponibilidad sin inferencia pagada automática.
