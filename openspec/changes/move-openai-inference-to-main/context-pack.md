# Contexto del cambio

- Objetivo: retirar credenciales y llamadas HTTP OpenAI del renderer/preload, conservando chat, herramientas y análisis en equipo.
- Actor: usuario autenticado de Hub/Orbe que inicia un turno o lo cancela.
- Alcance: Responses API nativa, streaming con lectura bajo demanda, fuente/documento/sesión, selección de clave Lia/entorno en main, errores públicos, cuatro capas IPC y exclusión de OpenAI del entorno público de Vite.
- No objetivos: migración Gemini/medios/OAuth, retirar secretos del instalador main, cambiar proveedores/modelos, RLS remoto, aislamiento global del estado Desktop o firma/release.
- Restricciones: sin secretos/.env reales, cuentas/proveedor real, GUI, SQL remoto, dependencias o relajación de reglas. Preservar índice ajeno y rama acumulada.
- Contratos: SDK Responses instalado, get_api_key(p_provider), sesión Lia nativa existente y API nueva open/start/pull/cancel sólo para Responses.
- Riesgo/HITL: el modelo no ejecuta herramientas locales en main; las llamadas devueltas mantienen el dispatcher y HITL existentes. I/O ya enviado no se revierte. No ofrecer fetch/URL/header arbitrarios.
- Criterios: clave sólo en main; usuario/proveedor/documento correctos; A/B/A y navegación revocan; streaming conserva texto/herramientas/citas/uso; Stop y abandono cierran iterador; límites y plaza física sin liberación prematura; error saneado conserva estado/reintento; build con secreto ficticio no lo expone en renderer/preload.
- Incertidumbres: integración servidor y proveedor real siguen sin certificarse; las claves incorporadas a main siguen extraíbles del instalador. La vinculación entre sujetos SOFIA/Lia conserva el contrato nativo existente, no se inventa una relación de tablas.
