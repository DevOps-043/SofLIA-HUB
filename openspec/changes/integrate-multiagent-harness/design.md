## Context

Meeting Ops ya tiene extracción, revisión, sincronización y deduplicación. El arnés añade análisis supervisado sin sustituirlos. La identidad de main solo contiene usuario; el contexto organizacional del arnés se selecciona y verifica contra membresía SOFIA.

## Goals / Non-Goals

Ejecución real desde UI, aislamiento por actor y organización, compatibilidad con Gemini y Codex, errores parciales visibles. No se exponen RPC genéricos ni filesystem al renderer.

## Decisions

1. DAG fijo: acuerdos y evidencia en paralelo, síntesis posterior. Evita delegación recursiva sin límite; roles y presupuestos son código del host, no instrucciones modificables por el modelo.
2. Catálogo cerrado: leer transcripción, buscar fragmentos y leer aportes de especialistas. Herramientas dinámicas del app-server; el mismo dispatcher sirve al proveedor Gemini. Se conserva la separación frente al MCPManager existente.
3. Codex con environments vacío, capacidades experimentales comprobadas por esquema local y respuesta del servidor, CODEX_HOME separado por identidad, entorno mínimo y sin herencia de configuración personal. No se copia auth.json. La persona introduce la clave API por el canal de configuración; main la custodia cifrada y autentica al proceso con almacenamiento efímero. El inventario MCP debe estar vacío antes de enviar contenido.
4. Persistencia de snapshots con safeStorage, escritura atómica y límite de historial. Sin cifrado del sistema, se informa modo volátil. Recuperación manual reinicia análisis de solo lectura; nunca reproduce efectos de negocio automáticamente.
5. Confirmación de crear borrador ligada a digest, propietario y sesión. Estado de publicación se persiste antes de llamar al servicio; fallo incierto impide repetir sin reconciliar. Se resuelve el owner Lia por separado del actor SOFIA y se vigilan ambas identidades entre etapas. El flujo Meeting Ops conserva sus aprobaciones posteriores.
6. IPC de ventana principal y frame principal, payloads Zod estrictos. Un cambio de contexto o sesión cancela ejecuciones y descarta resultados tardíos.
7. Codex opcional elegido con diálogo nativo; no se ejecutan rutas arbitrarias proporcionadas por contenido del modelo. La versión y los contratos comprobados se muestran en estado.

## Risks / Trade-offs

- API experimental de Codex → comprobar esquema y respuesta; no degradar a ejecución con entorno local.
- Pérdida de red tras escritura → estado incierto y reconciliación con Meeting Ops; sin reintento automático.
- Presupuesto de tokens → limitar llamadas/salida/tiempo; uso observado no representa facturación exacta.
- Cifrado no disponible → modo volátil explícito, nunca persistencia en texto claro.
- Cambio de organización → entrada de contexto autenticada y verificada, invalida generación de sesión.

## Migration Plan

Adición sin migración de base. Gemini sigue disponible; Codex requiere selección local y credenciales separadas. Rollback: retirar registro/panel del arnés; el historial de reuniones creado permanece en su flujo original.
