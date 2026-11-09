## Why

El servicio del navegador conserva más de 5600 líneas y coordina campos de
percepción, dos promesas, sus destinos, cachés y un temporizador junto a otras
responsabilidades. La invalidación por booleano/URL no demuestra que una promesa
pertenezca al ciclo actual después de pausar/reactivar. Se requiere una frontera
de ciclo de vida comprobable, sin dividir archivos sólo por tamaño.

## What Changes

- Reproducir la carrera de pausa/reactivación y otros resultados tardíos.
- Concentrar estado/cachés/trabajos/timer de percepción en un módulo main con
invalidación explícita y publicación asociada a su ciclo/documento.
- Mantener capturas físicas serializadas por tipo y coalescencia únicamente para
el destino vigente; conservar autorización, privacidad, cadencia y consumo API.
- Añadir contratos unitarios/de servicio y smoke nativo dirigido; documentar
límites de invalidación lógica y compatibilidad.

No se agregan dependencias, canales, permisos, persistencia o funcionalidades.

## Capabilities

### New Capabilities
- `browser-perception-lifecycle`: propiedad e invalidación de percepción efímera.

### Modified Capabilities

Ninguna especificación vigente cambia su contrato público.

## Impact

Servicio main del navegador, módulo interno nuevo, pruebas, arnés nativo y
documentación de arquitectura/privacidad. Main/preload/renderer mantienen sus
capas y formatos. No modifica datos o empaquetado ni ejecuta acciones remotas.
