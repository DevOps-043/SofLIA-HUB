## Why

Desktop Agent expone lecturas/controles sin autorización de fuente y mutaciones
con argumentos no validados. Su teclado admite secuencias arbitrarias en scripts;
la observación puede actuar después de detenerse y configuración oculta fallos.

## What Changes

- Autorizar/validar los 23 canales y exigir revisión nativa de efectos.
- Mantener control de abort/stop disponible durante trabajo, con cuotas sin cola.
- Propagar señales main a tareas/observación y descartar resultados revocados.
- Cerrar combinaciones de teclado y separar texto de opciones/script.
- Validar configuración; conservar estado previo si falla persistencia.
- Capability de revisión nativa en preload evita doble diálogo del renderer.

## Capabilities

### New Capabilities
- `desktop-agent-ipc-authority`: contratos, fuente, revisión y ciclo de operaciones.

### Modified Capabilities
Ninguna especificación canónica modificada.

## Impact

Main, servicio/handlers, configuración/teclado/observación, shared, preload y
consumidores. Sin canales, dependencias o migraciones nuevos; pruebas con puertos
simulados. No se ejecuta entrada GUI ni se modifican configuraciones del usuario.
