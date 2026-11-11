## Why

La reevaluación para integrar ramas detectó 33 paquetes afectados en npm,
incluidos dos de severidad alta. El diagnóstico de octubre ya no representa
los avisos actuales. Se reprodujo con dos servidores locales y credenciales
ficticias la propagación de una cabecera sensible al redirigir entre orígenes.

## What Changes

- Aplicar parches compatibles de systeminformation y follow-redirects.
- Resolver transitivas dentro de los rangos de sus consumidores, sin forzar
  cambios mayores ni ocultar avisos.
- Contrastar auditoría, lock, ganchos, contratos funcionales y build aislado.

## Capabilities

### New Capabilities
Ninguna: parches de implementación con `skip_specs: true`.

### Modified Capabilities
Ninguna: se conservan APIs, permisos y datos.

## Impact

Manifest y lock raíz, contratos de dependencias y evidencia. Sin cambios en
secretos, configuración local, cuentas, tablas, canales IPC ni publicación.
