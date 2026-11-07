## Context

`getApiKey` se exporta de forma directa y también mediante un módulo histórico.
Una guarda exclusiva de su consumidor deja esas rutas públicas sin protección.

## Decisions

Mover el control de revisión a la guarda compartida y aplicar esta a la lectura
RPC. La fachada con nombre histórico delega sin añadir un listener adicional.
La invalidación por mutación afecta lecturas, no invalida la propia escritura.
Errores de RPC mantienen mensaje público; sesión revocada detiene el fallback.

## Risks

Las solicitudes ya iniciadas no se revierten. Los eventos son locales a la sesión
SDK y no sustituyen autorización de servidor; revisión independiente pendiente.
