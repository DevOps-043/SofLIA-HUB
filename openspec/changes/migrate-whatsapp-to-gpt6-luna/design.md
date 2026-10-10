## Context
El bucle existente procesa partes y respuestas de herramientas con contratos internos derivados de Gemini. Sus guardas deben conservarse.
## Goals / Non-Goals
Migrar razonamiento y decks a Luna sin cambiar permisos. No migrar voz, Computer Use, reuniones ni el selector del chat.
## Decisions
Adaptador Responses por turno: historial textual compatible, imágenes/PDF/texto, herramientas convertidas a JSON Schema, call_id emparejado y razonamiento conservado con store:false. Reutilizar el RPC get_api_key con proveedor openai y sesión Hub; fallback de entorno OpenAI existente, nunca clave Gemini. Sin reintentos automáticos de efectos ni fallback de modelo.
## Risks / Trade-offs
OpenAI debe estar configurado. Los formatos no admitidos se rechazan explícitamente; las notas de voz siguen su transcriptor. El monitor y los límites de especialistas permanecen.
## Migration Plan
Pruebas de protocolo y regresión, gate PR y build. Reversión por commit sin cambios de datos.
