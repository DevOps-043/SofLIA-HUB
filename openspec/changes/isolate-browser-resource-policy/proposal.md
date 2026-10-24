## Why

El coordinador del navegador concentra dos decisiones de suspensión y su temporizador. La vía del presupuesto de vistas ignora el trabajo protegido que sí respeta la vía de inactividad, pudiendo cerrar audio/captura al abrir otras pestañas.

## What Changes

- Extraer política de presupuesto, inactividad y su timer/generación a un módulo con contratos propios.
- Mantener snapshot/destrucción de vistas, perfil, layout y API en el servicio mediante puertos acotados.
- Aplicar protección de carga/audio/captura/DevTools también bajo presión; reevaluar el objetivo de ocho vistas al cesar el trabajo.
- Preservar criterios warm, gracia, visibilidad y throttling, con pruebas dirigidas, regresiones y Electron nativo aislado.

## Capabilities

### New Capabilities
- `browser-resource-lifecycle`: gestión coherente de vistas sin suspender trabajo protegido y con temporizador invalidable.

### Modified Capabilities
Ninguna. Canales, métodos públicos y persistencia conservan sus contratos.

## Impact

service.ts, nuevo módulo interno, suites del navegador, harness nativo y documentación. Sin dependencias/canales/SQL ni cambios de secretos. El objetivo de ocho vistas admite exceso temporal protegido; no se promete un límite duro que exigiría interrumpir ese trabajo ni una mejora medida de memoria.
