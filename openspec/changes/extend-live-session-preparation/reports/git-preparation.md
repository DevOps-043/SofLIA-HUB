# Preparación Git de las entregas locales

Fecha: 18 de noviembre de 2026.

## Alcance

Se preparan commits locales coordinados para plan, notas y documentos de sesión. La rama de trabajo creada en los tres repositorios es `codex/live-session-preparation`. Se conserva el checkout existente, sin mover ni limpiar archivos y sin crear worktrees. No se realiza push, pull request, despliegue ni migración remota.

Bases inspeccionadas: Hub `fa3ace41` desde `codex/fix-iris-account-bootstrap`; Architect `3683f20f` desde `staging`; Academy `bbdd240c8` desde `main`. Estas bases pueden contener cambios anteriores y deberán revisarse al elegir la rama objetivo de integración.

## Selección de archivos

- Architect: únicamente cambios de `apps/web/src/domains/course-delivery/`, su documento de ampliación y la referencia en la guía operativa síncrona. Se excluyen los cambios existentes de fuentes documentales, artefactos, funciones Netlify, lockfile, migraciones y reporte de Herk.
- Academy: contratos y dominio de preparación/estudio, recepción interna, negociación HTTP, proyección por audiencia, pruebas y documentación asociadas.
- Hub: contratos compartidos, sincronizador, frontera HTTP, panel de conducción, documentos del participante, pruebas, documentación y este cambio OpenSpec. La diferencia local de `recordings.contract.ts`, sin diff de contenido, se conserva fuera del commit.

Se comprueba que el índice esté vacío antes de seleccionar archivos, se revisa su contenido y se comparan los cambios restantes tras cada commit. No se usa `git add .`.

## Verificación y riesgos

La evidencia funcional del 17 de noviembre permanece en los reportes de primera y segunda entrega. El 18 de noviembre se repitieron las suites dirigidas: Architect 34 pruebas, Academy 35 y Hub 56, todas aprobadas. En Hub, el primer intento terminó con 33 pruebas aprobadas y dos errores de inicio de worker por timeout; las dos suites afectadas pasaron sus 23 pruebas al repetirse sin las otras verificaciones concurrentes. Esta preparación Git no convierte en aprobadas las compuertas generales pendientes de Electron, enlaces anteriores, dependencias de Academy ni SQL/PGlite. No se repitieron las compuertas globales de tipos o verify:pr durante esta preparación sin cambios funcionales.

El sincronizador de contratos, los enlaces de 1121 documentos activos, el arnés de 25 rutas y 10 skills y la validación estricta del cambio OpenSpec aprobaron. La comparación SHA-256 confirmó que los 23 archivos excluidos de Architect conservan su contenido.

Commits coordinados ya guardados: Architect `43c54371` (21 archivos) y Academy `9fc2c6457` (17 archivos). El commit de Hub que contiene este reporte completa la selección revisada de 25 archivos.

La revisión de alcance comprueba privacidad de notas y respuestas, publicación por ID, compatibilidad por cabecera, límites y reenvíos. Se corrige una referencia documental obsoleta al límite de 32 KiB en Architect y se incorpora la segunda entrega al resumen de la propuesta. No se modifica comportamiento funcional durante esta preparación.

Las verificaciones se ejecutan sobre los checkouts actuales, que contienen trabajo preexistente en Architect. La validación del commit en un checkout limpio y CI continúa siendo requisito antes de integrar o desplegar.

## Integración y reversión

Publicar primero Academy compatible y después Architect y Hub. Mantener backend capaz de leer el estado ampliado después de su primera escritura. Los commits locales son recuperables mediante Git; una reversión posterior debe conservar datos y coordinar compatibilidad. El cambio OpenSpec permanece abierto hasta completar las entregas pendientes y su integración.
