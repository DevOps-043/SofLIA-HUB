## ADDED Requirements
### Requirement: Proveedor Luna
El sistema SHALL usar gpt-6-luna en coordinador WhatsApp, especialistas y generación de presentaciones de WhatsApp, manteniendo las guardas del ejecutor.
#### Scenario: Herramienta autorizada
- **WHEN** Luna solicita una herramienta del catálogo permitido
- **THEN** el ejecutor existente aplica permisos y confirmación, y su resultado vuelve con el call_id original.
#### Scenario: Falta de credencial
- **WHEN** no existe credencial OpenAI
- **THEN** el sistema informa la configuración faltante sin usar Gemini como sustituto.
#### Scenario: Presentación
- **WHEN** se genera un deck
- **THEN** especialistas y coordinador usan Luna y se valida deck.json antes de escribir o exportar.
