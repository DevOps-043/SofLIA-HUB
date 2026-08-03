# Estandar de interfaz de Pulse Hub

Estado: vigente. Actualizado: 2026-07-21.

La especificacion visual completa esta en
[sistema visual y paleta](../ux/design-system.md). Este archivo contiene las
reglas obligatorias de implementacion.

<!-- evidence: src/index.css -->
<!-- evidence: src/components/ui -->

- Usar tokens `background`, `sidebar`, `card`, `surface-2`, `border`, `primary`,
  `accent`, `on-accent`, `secondary`, `success`, `warning` y `danger`; no crear
  otro color de marca local sin documentarlo.
- Toda superficie nueva debe funcionar en tema claro y oscuro.
- Texto sobre `accent` usa `on-accent`; en dark es navy para mantener contraste.
- Reutilizar primitives de `src/components/ui/` para Button, Card, fields,
  TextArea, Toggle, Badge, SectionHeader y SelectDropdown.
- Estados obligatorios: loading, empty, error, disabled, focus, success cuando
  aplique y degradado para integraciones no disponibles.
- Controles icon-only requieren `aria-label`; formularios requieren label
  programatico, errores asociados y orden de tab coherente.
- No depender solo de color para riesgo/estado; acompanar con texto o icono.
- Respetar `prefers-reduced-motion` al agregar animaciones no esenciales; las
  animaciones existentes no eximen esta regla.
- No usar HTML externo sin sanitizacion y limite de longitud.
- Verificar manualmente teclado, foco, 200% zoom, claro/oscuro y ventana minima de
  320 px antes de cerrar un cambio visible.

Los patrones de una aplicacion SOFIA web externa no son fuente canonica del Hub;
solo cuentan los componentes y tokens versionados en este repositorio.
