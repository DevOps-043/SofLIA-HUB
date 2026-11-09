## Why
Las subidas de medios no limitan trabajo físico y retienen clientes por clave.

## What Changes
Limitar cuatro subidas físicas, conservar plazas hasta concluir I/O, revocar
resultados tras invalidación interna y retirar la caché indexada por credencial.

## Capabilities
### New Capabilities
- `media-resource-limits`: cuotas y vigencia de subidas físicas de medios.
### Modified Capabilities
Ninguna.

## Impact
Servicio main y pruebas. No cancela I/O remoto ni limita todo el estado histórico.

## Ajuste de verificación
El gate detectó un timeout en la prueba del presupuesto documento/shadow DOM.
Se aísla la visibilidad de ese caso de conteo para evitar coste CSS de JSDOM,
conservando los 4100 nodos y el límite productivo. Casos separados verifican
campos ocultos con estilos reales. No se amplían timeout ni exclusiones.
