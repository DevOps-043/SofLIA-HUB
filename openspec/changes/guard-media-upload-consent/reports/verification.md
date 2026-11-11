# Verificación de consentimiento de medios

Fecha: 2026-11-05. Estado local, sin transferencias ni cuentas reales.

Se vincula consentimiento a una guarda de sesión. Se comprueba la misma aprobación
tras resolver la clave y al recibir la subida. Reaprobar no habilita una solicitud
anterior; existe como máximo una suscripción de consentimiento y se libera al
restablecer o consultar una aprobación revocada. Cinco pruebas dirigidas cubren
los casos y el envío válido; servicios de clave y transferencia son simulados.

Compuerta `npm run verify:pr`: código 0, 7048 pruebas aprobadas y cinco omitidas.
Cobertura en 2629 fuentes: líneas 60.45%, sentencias 58.96%, funciones 55.40% y
ramas 52.39%. Lint dirigido y especificación pasaron. Logs, código de salida y
respaldos: `%TEMP%/soflia-media-consent-2026-11-05/`.

Una subida enviada no se revierte. El renderer todavía resuelve y transmite la
clave a main en esta ruta; su migración y revisión independiente siguen pendientes.
La protección local no sustituye autorización nativa ni reglas de servidor. No
se acreditan proveedor real, GUI, instalación o integración de ramas.
