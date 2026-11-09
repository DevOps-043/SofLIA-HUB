## Why

Cuatro motores de recuperación duplican consumo y un plazo de cinco minutos
basado sólo en Date.now. Atrasar el reloj puede extender ese plazo; algunas
rutas sólo lo comprueban antes de esperas o proyecciones, sin incluir el momento
de publicar. La aprobación de recuperación debe mantener una vigencia acotada.

## What Changes

- Reproducir el retroceso de reloj y las esperas que cruzan el plazo.
- Compartir una primitiva main de revisión consumible con reloj monotónico y
límite de pared conservador: vencer por cualquiera no puede revertirse.
- Revalidar junto a las guardas existentes antes de nuevas publicaciones o
efectos. Conservar marcadores sync y recuperación ante estados parciales.
- Verificar consumidores, reloj real/Electron y pruebas negativas; documentar
límites sin atribuir el bloqueo a un tenedor no identificado ni confundirlo
con la extensión de plazo.
- Incorporar reintentos acotados de rename EPERM/EBUSY en Windows, revalidando
actor, plazo y archivos tras cada espera. Un bloqueo con FileShare.Read produjo
EPERM real y reprodujo el fallo; no se identifica el tenedor del fallo histórico.

No agrega dependencias, canales, permisos, persistencia o operaciones remotas.

## Capabilities

### New Capabilities
- `browser-recovery-review-lifetime`: límite temporal y consumo único de revisiones.
- `browser-policy-file-publication`: publicación resistente a bloqueo transitorio con precondiciones verificadas.

### Modified Capabilities

Ninguna especificación vigente cambia su formato público.

## Impact

policy-file-recovery, semantic-memory-recovery, sqlite-store-recovery y
sync-state-recovery, primitiva interna de vigencia y arnés/tests/documentación.
Servicios/handlers/HITL, preload y renderer conservan sus contratos. No aplica
migraciones ni ejecuta restauraciones sobre perfiles reales.
