## Purpose

Ejecutar Responses de OpenAI desde el proceso nativo de Soflia Hub, sin
entregar claves de ese proveedor al renderer por el nuevo contrato de inferencia.

## ADDED Requirements

### Requirement: Credenciales y autoridad nativas
El sistema SHALL derivar credencial, usuario, sesión y fuente en main y rechazar
identidad, claves, rutas HTTP, headers o endpoints arbitrarios aportados al canal.
#### Scenario: Fuente o sesión revocada
- **WHEN** una fuente ajena llama o la sesión cambia A/B/A mientras espera
- **THEN** no se inicia otro efecto ni se devuelve una respuesta en la sesión posterior
#### Scenario: Clave disponible o consulta fallida
- **WHEN** existe clave personal vigente o falla su consulta
- **THEN** se usa la personal sin entregarla al renderer, y un fallo no selecciona silenciosamente otra clave
#### Scenario: Transición entre publicación main y sesión Lia
- **WHEN** main cambia de identidad y la sesión Lia anterior aún no terminó de sustituirse
- **THEN** OpenAI rechaza ese vínculo hasta una publicación nativa aplicada y vigente, sin presumir igualdad de IDs SOFIA/Lia

### Requirement: Compatibilidad de Responses
El sistema SHALL conservar chat, llamadas de herramienta, citas, texto, uso,
análisis en equipo y selección de modelos existentes, incluidos sus reintentos.
#### Scenario: Respuesta normal o stream legítimo
- **WHEN** un consumidor solicita Responses con sus parámetros admitidos
- **THEN** recibe el mismo contenido funcional sin ejecutar HTTP autenticado en renderer

### Requirement: Recursos y cancelación
El sistema SHALL acotar trabajos, payload, volumen y tiempo, con una lectura
por trabajo y cancelación/replay controlados sin liberar prematuramente I/O vivo.
#### Scenario: Stop o consumidor abandona un stream
- **WHEN** la tarea se cancela o deja de consumir
- **THEN** se cancela/cierra el proveedor y no se admiten trabajos por una plaza aún ocupada físicamente
#### Scenario: Pull duplicado o payload excesivo
- **WHEN** se repite un cursor, se solapan lecturas o se excede el presupuesto
- **THEN** no se duplica consumo ni se crea almacenamiento o concurrencia ilimitados

### Requirement: Empaquetado y errores públicos
El sistema SHALL excluir la clave OpenAI del entorno público renderer/preload y
devolver errores controlados sin credenciales ni cuerpos/headers privados.
#### Scenario: Build con una clave centinela y fallo del proveedor
- **WHEN** se compilan las superficies o el proveedor rechaza la operación
- **THEN** el centinela no aparece en renderer/preload ni en respuestas/logs de error
