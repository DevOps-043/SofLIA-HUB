## Context

Ver proposal.md. La unidad anterior sigue en codex/reduce-technical-debt sin commit;
se conserva. El lock raíz fija las versiones efectivas y hay otro lock de Zoom
que no se mezcla con esta actualización. El gate previo pasó 4476 pruebas.

## Goals / Non-Goals

Reducir avisos actuales y sostener los contratos existentes. No se introducen
abstracciones, APIs ni nuevas capacidades runtime. Se evita una actualización
global que mezcle cambios mayores con parches de seguridad.

## Decisions

- Usar Sharp 0.35.5, Vite 8.2.4 y Vitest/coverage 4.1.12, versiones consultadas
  en el registro. Fijar estas versiones en manifest y lock permite revisar este
  conjunto concreto; futuras actualizaciones requieren la misma verificación.
  Se conservan las líneas actuales y no se abre una nueva versión mayor.
- Resolver transitivas seleccionadas con npm update dentro de los rangos de sus
  consumidores. No forzar overrides ni aceptar downgrades sugeridos por audit.
- Resolver primero con package-lock-only e ignore-scripts; inspeccionar diff,
  hashes y ganchos antes de instalar también con ignore-scripts. Los binarios
  opcionales de Sharp se verifican ejecutando procesamiento de imágenes real.
- Medir audit antes/después bajo la misma consulta y conservar avisos residuales.
  El conteo es de paquetes afectados, no fallos explotables independientes.
- Probar los consumidores de imágenes/documentos, suite completa y build aislado
  con el smoke existente que excluye .env y configuraciones locales.

## Risks / Trade-offs

- Binarios/libvips incompatibles: ejecutar Sharp real y casos de documentos;
  Windows local no acredita Linux/macOS.
- Diferencias de Vite/Vitest: ejecutar tipos, gate y compilación aislada.
- Resolución npm con cambios laterales: revisar cada paquete y mantener sólo
  rangos compatibles; no instalar ganchos nuevos.
- Avisos sin parche compatible: documentar consumidor y trabajo requerido,
  conservando la evidencia; no silenciar auditoría.

## Migration Plan

Sin migración de datos. Instalar desde el lock revisado en desarrollo/CI.
Rollback: restaurar únicamente manifest/lock de esta unidad y reinstalar sus
versiones anteriores, preservando los scripts y cambios de la unidad previa.
El rollback reintroduciría los avisos corregidos. Sin despliegue ni archivo
del cambio antes de revisión independiente.

## Hallazgo durante verificación

El filtro del smoke no incluía los tres configs Vite auxiliares ni las seis
fuentes del runtime Zoom. La regresión reproduce nueve rechazos incorrectos.
Se amplía la allowlist con esas rutas exactas, sin copiar el árbol completo de
packages, y se exige presencia no vacía de los tres artefactos runtime al terminar
build:app. Se conservan las exclusiones de secretos/cachés y se añaden casos para
configuración local y paquetes ajenos. Es reparación del verificador requerido
para probar Vite, sin cambio de comportamiento del producto.
