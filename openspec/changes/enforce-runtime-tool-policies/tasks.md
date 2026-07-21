## 1. Contrato y validación

- [x] 1.1 Definir tipos cerrados para schemas, política runtime, contexto, errores y eventos de auditoría.
- [x] 1.2 Implementar parser Zod del contrato y compilador estricto de JSON Schema para entrada/salida.
- [x] 1.3 Rechazar desde el loader herramientas ejecutables incompletas o con contratos no soportados.

## 2. Ejecutor gobernado

- [x] 2.1 Aplicar validación de agente, grupo y HITL antes de invocar handlers.
- [x] 2.2 Validar argumentos/resultados y añadir timeout con `AbortSignal`.
- [x] 2.3 Emitir auditoría minimizada y correlacionada desde `MCPManager`.

## 3. Integración runtime

- [x] 3.1 Pasar contexto gobernado desde el servicio de herramientas dinámicas.
- [x] 3.2 Integrar la política dinámica con la confirmación HITL existente de WhatsApp.
- [x] 3.3 Migrar Home Assistant con contratos de lectura/escritura, schemas de salida y cancelación.
- [x] 3.4 Exponer política segura en inventario y diagnóstico sin filtrar secretos.

## 4. Pruebas y documentación

- [x] 4.1 Cubrir loader, schemas estrictos, permisos, grupos, HITL, timeout y auditoría con pruebas unitarias.
- [x] 4.2 Cubrir el diálogo HITL de WhatsApp y la migración de Home Assistant.
- [x] 4.3 Documentar el contrato, migración de plugins legacy y límites de seguridad.

## 5. Verificación y cierre

- [x] 5.1 Validar OpenSpec, tipos, lint incremental y pruebas dirigidas.
- [x] 5.2 Ejecutar `verify:pr` y `build:app` sin regresiones atribuibles.
- [x] 5.3 Realizar revisión adversarial de bypass, secretos, timeout, rutas y rollback; adjuntar evidencia.
