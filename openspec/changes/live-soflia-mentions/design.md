## Decisions

La mención pública se envía como mensaje normal del aula. Hub solicita la respuesta a Learning con el identificador confirmado de la pregunta propia. Learning reserva el turno y verifica la política, el consentimiento, la moderación y la sala. Tras generar, confirma de nuevo la autorización y publica una respuesta vinculada a la pregunta original. Una llamada repetida conserva una única respuesta y un turno fallido se puede reintentar. Realtime se limita a invalidar el snapshot.

Learning construye el contexto con título, descripción, escenas, prácticas, archivos publicados compatibles, pregunta y opciones del quiz activo y aportaciones recientes de la sala con consentimiento. La inferencia se ejecuta sin herramientas. Se excluyen claves y borradores de quiz, entregas ajenas, conversaciones de otras salas y credenciales de almacenamiento. Describe las fuentes incluidas y sus límites. Las notas o transcripciones compartidas como material usan la misma frontera de acceso que cualquier otro archivo.

El contrato se negocia con `X-Soflia-Studio-Tutor: 1` y reutiliza `learning-live:studio`. Clientes anteriores conservan el snapshot compatible. El chat privado conserva un historial local por aula y envía sus consultas al mismo contexto autorizado cuando Learning negocia la capacidad.

## Rollout

Aplicar la migración en SOFIA y publicar Learning antes de distribuir Hub. La migración agrega una tabla privada y RPC de servicio sin alterar el formato persistido del estudio. Para desactivar la capacidad se puede revertir el servicio y conservar la tabla. El piloto con dos cuentas verifica el mismo hilo y los permisos en tiempo real.
