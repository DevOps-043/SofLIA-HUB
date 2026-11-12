# Agente visual tridimensional

Estado: base estructural en revisión visual. Actualizado: 2026-11-11.

<!-- evidence: soflia-ai-agent/integration/web/controller.ts -->
<!-- evidence: soflia-ai-agent/integration/web/viewer.ts -->
<!-- evidence: soflia-ai-agent/blender/scripts/build_premium_a.py -->

El [módulo visual](../../soflia-ai-agent/README.md) contiene la primera base Blender
de «A — Núcleo horizontal», seleccionada explícitamente entre tres siluetas grises.
Su acabado estático vigente añade marino satinado, flujo turquesa integrado en el
mismo sólido, visor oscuro, ojos luminosos y el logo con el PNG original empaquetado.
Se conservan la base gris y su comparación de contornos; la escena premium tiene
siete vistas sin resplandor de posproducción y una presentación Cycles independiente.
Los modelos V2–V5 y el comparador web anterior se conservan como antecedentes;
no muestran la nueva base A. Animación e integración siguen detenidas.

El [adaptador React previo](../../soflia-ai-agent/integration/electron/SofliaAvatar.tsx)
y su controlador AnimationMixer se conservan, pero todavía no se han adaptado al
modelo reconstruido. No deben cargar el GLB base sin clips. No modifica el chat,
no accede a Node y no crea IPC.
La lógica de IA sólo entrega estado y amplitud; no controla Blender ni scripts del
plano de desarrollo. El generador queda fuera del runtime del producto.

Los contratos, parámetros, comandos y límites se mantienen en el README del módulo.
Las decisiones y criterios verificables viven en el
[cambio OpenSpec](../../openspec/changes/build-soflia-3d-agent/design.md).
La forma descartada de cintas cruzadas no constituye una propuesta de identidad vigente.
