# Resumen ejecutivo: integración Architect → Learning → Hub

**Fecha:** 18 de noviembre de 2026.  
**Estado:** cambios publicados en ramas de trabajo; integración, despliegue y piloto pendientes.

## Objetivo

Conectar las tres plataformas para crear e impartir talleres híbridos con una experiencia continua. Las lecciones asíncronas se estudian en **Learning** y las sesiones en vivo se imparten en **Hub**. **Architect** prepara el contenido y los materiales de ambas modalidades.

La ruta acordada es **Architect → Learning → Hub**. Learning conserva la relación con el curso, valida los accesos y distribuye a Hub la preparación correspondiente a las sesiones síncronas. El alcance de esta conexión es trasladar esa preparación, sin mover las lecciones asíncronas a Hub.

## Cambios por plataforma

| Plataforma | Cambios realizados | Beneficio para el objetivo |
| --- | --- | --- |
| **Architect / CourseForge** | Formulario compartido para cursos asíncronos, síncronos e híbridos, con campos específicos por modalidad y ayudas contextuales que explican la selección vigente. Generación y validación de planes por sesión, láminas, notas del instructor y documentos didácticos, con aprobación del contenido. | Preparar desde el origen la estructura y los materiales necesarios para impartir cada taller. |
| **Learning / Academy** | Recepción y custodia de la preparación síncrona, validación de acceso y proyección por audiencia. Publicación y retirada de materiales para participantes, protegiendo notas y respuestas privadas. | Mantener el vínculo con el curso y respetar los permisos antes de entregar la información a Hub. |
| **Hub** | Consulta del plan de sesión, notas privadas del ponente y documentos de apoyo. Interfaz para compartir materiales autorizados y distinguir contenido reservado, compartible y publicado. | Poner la preparación a disposición del instructor y del grupo durante la sesión en vivo, según sus permisos. |

## Alcance disponible

La implementación permite transportar contenido estructurado de preparación: bloques del plan, tiempos, notas del ponente y documentos con secciones diferenciadas para instructor y participante. La ampliación contempla un paquete de 14 documentos por sesión, incluidos entregables condicionales cuya aplicabilidad debe justificarse.

Las validaciones cubren permisos, organización, referencias, límites de contenido, vigencia de aprobaciones, compatibilidad de clientes y reenvíos. Learning conserva las secciones privadas y entrega al participante únicamente las secciones públicas que el instructor haya compartido.

El formulario de Architect permite elegir la modalidad desde la creación. Sus ayudas «?» tienen fondo opaco y combinan una explicación general con la descripción de la opción seleccionada.

## Estado de publicación y verificación

Los cambios quedaron publicados en la rama **codex/live-session-preparation** de cada repositorio:

| Plataforma | Commit publicado |
| --- | --- |
| Architect | [a61e975c](https://github.com/DevOps-043/courseforge/commit/a61e975c) |
| Hub | [fa0595fd](https://github.com/DevOps-043/SofLIA-HUB/commit/fa0595fd) |
| Learning / Academy | [9fc2c6457](https://github.com/DevOps-043/SofLIA-Academy/commit/9fc2c6457) |

En la preparación de publicación pasaron 113 pruebas dirigidas de Architect y 28 pruebas de interfaz de Hub. Las pruebas de participante de Hub se repitieron por separado después de un timeout al iniciar su worker. También se verificaron los tipos de Architect y Hub, el lint dirigido o incremental y la revisión visual local documentada.

Las compuertas generales conservan bloqueos documentales previos: enlaces del reporte de Herk en Architect e inventario de pruebas desactualizado en Hub. La publicación de las ramas no equivale a una aprobación completa para integrar o desplegar. No se realizó merge ni despliegue manual.

## Pendientes para completar la experiencia

1. **Archivos y medios:** vincular recursos a bloques mediante identificadores persistentes y habilitar la transferencia y consulta privada de archivos, B-roll y videos de demostración o guía.
2. **Teleprompter:** conectar las notas o el guion recibido con la experiencia de teleprompter de Hub. La recepción y consulta de notas privadas ya están implementadas; la conexión completa permanece pendiente.
3. **Operación del taller:** completar las encuestas y el registro de evidencias, incidencias, contingencias y actividades posteriores o por ausencia.
4. **Validación integral:** ejecutar un curso desde Architect, revisar y aprobar sus generaciones, entregar la preparación a Learning y comprobar su consumo en Hub con instructor y participante.
5. **Integración y despliegue:** resolver los bloqueos de las compuertas y coordinar versiones compatibles. El orden previsto de despliegue es Learning/Academy, después Architect y Hub.

La creación automática de salas queda fuera del alcance de este trabajo. Su implementación corresponde al módulo responsable de las salas de Hub.

## Resultado esperado

El instructor prepara el taller en Architect, Learning conserva el contexto del curso y controla el acceso, y Hub presenta los materiales necesarios para impartirlo en vivo. El estudiante mantiene sus lecciones asíncronas en Learning y participa en las sesiones síncronas desde Hub.

## Documentación de respaldo

- [Arquitectura de entrega de preparación síncrona](../architecture/architect-live-preparation-delivery.md).
- [Ruta coordinada de ampliaciones](../../openspec/changes/extend-live-session-preparation/roadmap.md).
- [Verificación de documentos y distribución por audiencia](../../openspec/changes/extend-live-session-preparation/reports/documents-verification.md).
- [Revisión visual y preparación de publicación](../../openspec/changes/extend-live-session-preparation/reports/visual-review.md).
