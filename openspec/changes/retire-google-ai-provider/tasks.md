## 1. Retirada completa

- [x] 1.1 Retirar selector Gemini, migrar preferencias y excluir clave de renderer/preload.
- [x] 1.2 Migrar equipos en segundo plano y reconciliar sus modelos.
- [ ] 1.3 Retirar rutas Gemini de chat, utilidades, Flow e imágenes.
- [x] 1.3.1 Migrar imágenes y Flow a OpenAI nativo, sin fallback web con claves.
- [x] 1.3.2 Migrar especialistas, títulos, redacción y optimización a Responses; retirar destino Gemini del optimizador.
- [ ] 1.3.3 Retirar conversación, grounding y transporte multimodal heredados después de cubrir su paridad.
- [ ] 1.4 Migrar agentes, WhatsApp, reuniones, memoria y control de escritorio.
- [x] 1.4.1 Migrar el arnés de análisis de reuniones a OpenAI y retirar su proveedor Gemini.
- [ ] 1.4.2 Migrar inferencia de reuniones, WhatsApp, memoria y control visual.
- [x] 1.4.3 Migrar clasificación/extracción de reuniones y retirar su clave Google del inicializador.
- [x] 1.4.4 Migrar tareas JSON del workspace y retirar setters de claves sin consumidores.
- [x] 1.4.5 Portar inferencia visual de Desktop, navegador y UIA a Responses con el catálogo y drivers locales.
- [ ] 1.4.6 Verificar paridad de audio de mensajería, incluidos formatos que requieren conversión.
- [ ] 1.4.7 Reindexar memoria conversacional anterior sin mezclar espacios de embeddings.
- [ ] 1.5 Retirar SDK, endpoints, claves, handlers y documentación operativa anteriores.
- [x] 1.5.1 Retirar el SDK anterior `@google/generative-ai` y el validador de credenciales Gemini sin consumidores.
- [ ] 1.6 Verificar ausencia de rutas activas y capacidades OpenAI, compuerta e instaladores.
- [ ] 1.7 Revisión independiente y cierre.
