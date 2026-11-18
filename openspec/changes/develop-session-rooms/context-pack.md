# Contexto del cambio

- Objetivo: desarrollar la gestión y el espacio de trabajo de salas de sesiones síncronas.
- Actor: instructor y participante autenticados en una sesión Learning.
- Alcance: preparación por actividad, distribución ajustable, asignaciones y nombres, entrada confirmada, instrucciones, integrantes, entregas individuales y regreso. Chat lateral y controles inferiores conservados.
- No objetivos: despliegue, migraciones remotas, autoría en Architect, entrega grupal compartida, documentos colaborativos o promesas de capacidad audiovisual.
- Restricciones: Architect propone y el instructor ajusta (confirmado por el usuario); contrato canónico Learning; clientes anteriores conservan sus respuestas; ningún estado local acredita una mutación remota.
- Contratos afectados: preparación Engine/Architect, estado/comandos Studio, proyección HTTP negociada y transporte existente de Hub.
- Riesgo y HITL: reasignar o cerrar requiere una acción explícita del instructor; no se ejecutan mutaciones de aulas reales durante desarrollo.
- Criterios: rechazar participantes administradores, usuarios bloqueados, IDs ajenos, equipos vacíos y operaciones con actividad individual; conservar video al cambiar paneles; conservar borradores y mostrar errores sin éxito anticipado.
- Incertidumbres: Architect todavía produce el manifiesto v1 sin metadatos de colaboración. Se prepara recepción opcional y se documenta la ampliación para el productor.
