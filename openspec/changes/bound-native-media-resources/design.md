## Context

El servicio main conserva el contrato IPC existente. Ver motivación en
[propuesta](proposal.md). La cuota corresponde a su instancia compartida.

## Goals / Non-Goals

La cuota mide trabajo físico iniciado, también si la sesión pierde vigencia.
No limita todavía todos los registros históricos ni aborta transporte del SDK.

## Decisions

- Contador con liberación en finally: rechazar exceso evita crear una cola de
  rutas/credenciales. Liberar al invalidar permitiría superar la cuota física.
- Revisión de sesión por operación y guardas después de esperas: un fallo o
  borrado tardío debe rechazar sin restaurar registros de la sesión retirada.
- Cliente por operación: elimina retención del mapa indexado por credencial;
  conservar el módulo SDK cargado evita repetir su carga y no almacena claves.

## Risks / Trade-offs

I/O del SDK sin respuesta → conserva plaza; no se promete cancelación física.
La cuota no cubre todas las lecturas y liberaciones remotas ni el historial →
se registra esa brecha para una unidad posterior. La limpieza remota es de mejor
esfuerzo; el proveedor conserva su política de caducidad.

## Migration Plan

No hay migración de datos, dependencia ni canal nuevo. Desplegar con el main
compilado y ejecutar contratos de medios. Para revertir esta unidad, restaurar
únicamente su diff desde el respaldo temporal y repetir la compuerta, preservando
las otras modificaciones acumuladas. No requiere efectos remotos.
