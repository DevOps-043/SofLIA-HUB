# Contexto y aceptación

Objetivo: retirar los avisos corregibles compatibles detectados al evaluar la
versión de escritorio para integración, manteniendo contratos y modularidad.

Fuentes: package.json, package-lock.json, auditoría npm del 7 de noviembre y
avisos oficiales de los mantenedores. Respaldo y reproducción bajo
`%TEMP%/soflia-november-advisories-2026-11-07/`.

Aceptación: sin versiones afectadas por los dos avisos altos identificados,
sin regresión de APIs consumidas, contrato local de redirección seguro,
compuerta de PR y build aislado aprobados. Registrar avisos residuales.

No objetivos: migraciones mayores, sustitución de librerías nativas ni
certificación multiplataforma. No usar `npm audit fix --force`.
