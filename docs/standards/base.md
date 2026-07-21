# Estandares base

## Principios

- Implementar una unidad verificable a la vez.
- Especificar antes de codificar cuando cambie comportamiento.
- Escribir o actualizar pruebas antes de cerrar una tarea.
- Favorecer tipos explicitos y APIs publicas pequenas.
- Mantener compatibilidad hacia atras mediante facades temporales, con fecha de
  retiro documentada.
- Tratar seguridad, autorizacion, idempotencia y observabilidad como requisitos,
  no como tareas posteriores.

## Idioma

- UI, prompts, comentarios, documentacion, pruebas descriptivas y logs: espanol.
- Nombres impuestos por librerias o APIs externas: conservar forma oficial.
- Identificadores existentes: no renombrar solo por estilo.

## Flujo de cambio

1. Leer `AGENTS.md`, estandares del area y cambio OpenSpec activo.
2. Confirmar alcance, no objetivos, riesgos y contratos afectados.
3. Trabajar en rama o worktree aislado.
4. Implementar tareas atomicas y registrar evidencia.
5. Ejecutar verificacion focalizada y luego el gate aplicable.
6. Actualizar documentacion y especificaciones.
7. Solicitar revision adversarial independiente antes de archivar.

## Seguridad

- No imprimir ni versionar secretos.
- Sanitizar entradas en limites IPC, HTTP, archivos y herramientas de agentes.
- Requerir HITL para borrado, shell, escritura externa, envio de mensajes y
  mutaciones irreversibles.
- Mantener bloqueadas las herramientas peligrosas en chats grupales.
- No empaquetar instrucciones de desarrollo dentro del runtime.

## Compatibilidad standalone

Los servicios ejecutables fuera de Electron no deben importar APIs de Electron
estaticamente. Usar carga dinamica con fallback comprobado.

## Definicion de terminado

- Criterios de aceptacion cubiertos.
- Typecheck exitoso.
- Pruebas focalizadas exitosas.
- Gate de PR exitoso o excepcion preexistente registrada.
- Contratos y documentacion sincronizados.
- Sin archivos generados, secretos ni enlaces rotos.
- Evidencia disponible bajo el cambio OpenSpec.
