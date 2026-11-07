## 1. Contrato

- [x] 1.1 Respaldar delta y reproducir acceso a credenciales/SDK en renderer.
- [x] 1.2 Definir DTO, límites, scope y campos Responses admitidos.

## 2. Integración nativa

- [x] 2.1 Implementar credenciales/autoridad, proveedor, trabajos y cierre físico en main.
- [x] 2.2 Registrar cuatro handlers, allowlist, preload y wrapper tipado sin fallback HTTP.
- [x] 2.3 Migrar cliente de chat/workers y excluir OpenAI de renderer/preload en Vite.

## 3. Evidencia

- [x] 3.1 Probar fuente/sesión, replay, límites, cancelación, SDK real con fetch ficticio y ambos consumidores.
- [x] 3.2 Revisar adversarialmente, documentar alcance/límites y verificar compuerta/build/hash finales.
