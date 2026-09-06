## 1. Sesión verificable en renderer

- [x] 1.1 Retirar la fabricación de una sesión SOFIA desde el snapshot local y cubrir la restauración sin credenciales verificables.
- [x] 1.2 Publicar `sofiaAccessToken` y `sofiaRefreshToken` vigentes mediante el wrapper tipado y actualizar el contrato preload/global.

## 2. Custodia e identidad SOFIA en main

- [x] 2.1 Extraer una custodia cifrada reutilizable y conservar las fachadas separadas para los refresh tokens Lia y SOFIA.
- [x] 2.2 Crear el coordinador de sesión SOFIA con aplicar, restaurar, renovar, revocar, validación de identidad y resultados seguros.
- [x] 2.3 Habilitar sesión renovable en el cliente SOFIA memoizado sin persistencia del SDK.

## 3. IPC y arranque

- [x] 3.1 Ampliar `auth:set-state` para validar el par SOFIA, aplicar la sesión antes de habilitar el gate y revocarla en logout sin devolver credenciales.
- [x] 3.2 Restaurar SOFIA antes de Lia y de los servicios; sincronizar el estado observable para permitir la autoconexión autorizada de WhatsApp.
- [x] 3.3 Mantener compatibilidad segura ante renderers sin tokens y sesiones SOFIA/Lia parciales o discrepantes.

## 4. Pruebas de regresión

- [x] 4.1 Probar custodia cifrada, falta de cifrado, token corrupto, aplicación, renovación, rechazo y revocación de SOFIA.
- [x] 4.2 Probar el contrato IPC para éxito, payload inválido, tokens ausentes, identidad discrepante y no filtración de credenciales.
- [x] 4.3 Probar que el snapshot local no autentica y que WhatsApp entrega un mensaje autorizado con sesión/membresía válidas, conservando los rechazos existentes.

## 5. Documentación y verificación

- [x] 5.1 Actualizar manual runtime, seguridad, contrato IPC y changelog con causa, operación y rollback.
- [x] 5.2 Ejecutar pruebas focalizadas, typecheck, lint de cambios, harness, documentación y `verify:pr`; registrar evidencia real.
- [x] 5.3 Ejecutar revisión adversarial de credenciales, RLS, allowlists, estados parciales y regresiones; corregir hallazgos dentro del alcance.
