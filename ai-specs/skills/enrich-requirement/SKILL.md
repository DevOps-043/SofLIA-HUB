---
name: enrich-requirement
description: Convierte una solicitud ambigua o amplia en un cambio implementable con alcance, no objetivos, contratos, riesgos, incertidumbres y criterios de aceptación verificables. Úsala antes de crear una propuesta OpenSpec o cuando una decisión faltante pueda cambiar materialmente la solución.
---

# Enriquecer requerimiento

1. Leer `AGENTS.md`, las normas del área y el código relacionado antes de asumir la arquitectura.
2. Identificar actor, problema, resultado observable y restricciones expresas.
3. Separar alcance, no objetivos y trabajo posterior.
4. Enumerar contratos afectados: IPC, datos, archivos, UI, integraciones y permisos.
5. Clasificar riesgos, acciones HITL e incertidumbres. Resolver mediante inspección todo lo descubrible.
6. Formular criterios de aceptación como escenarios comprobables, incluidos errores y permisos denegados.
7. Producir un Context Pack con `ai-specs/templates/context-pack.md` y usarlo para la propuesta OpenSpec.

No convertir preferencias menores en bloqueos. Preguntar solo cuando una elección no comprobable cambie materialmente el resultado o requiera nueva autoridad.
