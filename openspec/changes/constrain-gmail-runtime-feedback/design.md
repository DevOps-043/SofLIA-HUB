## Context

Ver propuesta/Context Pack. El servicio ya conserva propietario/cliente y resultados de cada operación; lotes/limpieza comprueban vacío y devuelven partial/uncertain/remaining. El verificador WhatsApp, en cambio, consulta toda una etiqueta tras una modificación individual y fabrica una segunda respuesta. El sidechannel cruza Calendar/Drive/Chat sin uso de dominio propio.

## Goals / Non-Goals

**Goals:** resultados ligados a las llamadas ejecutadas, sin lectura global ni órdenes automáticas añadidas; menos estado transversal y pruebas de integración que reproduzcan el fallo.

**Non-Goals:** reescribir el agente, nuevo sistema de verificación, canales/permisos, nueva política HITL global o afirmar que el modelo jamás volverá a proponer operaciones.

## Decisions

- Retirar bulk-label-verification y su invocación. No sustituirlo por otro prompt: una acción individual no implica vaciar una etiqueta y los lotes ya verifican en el servicio. Esto elimina lecturas adicionales de metadata y logs privados de ese módulo.
- Eliminar bulkLabelsToVerify de GoogleExecutorResult/GoogleExecutor, router, seis ejecutores, dispatch y executeWhatsAppTools. Mantener los contenedores response/responses y el orden existente para no mezclar otra reestructuración del dispatcher.
- El ejecutor Gmail entrega sin reinterpretar el resultado de cada método; no coerciona delete_label con `|| false` porque el servicio valida booleanos. Sus errores inesperados se vuelven genéricos, sin mensajes crudos del proveedor.
- El loop envía exactamente los resultados reales al adaptador de chat. Las reglas existentes de grupos, intención, confirmación, firmas repetidas y evidencia siguen en sus puntos actuales; las pruebas las conservan. La relación call_id del adaptador se comprueba sin red ni proveedor real.
- El adaptador OpenAI tenía compatibilidad explícita con resultados extra del verificador: los convertía en un mensaje user. Retirar esa promoción y rechazar extras antes de mutar su historial/pending, permitiendo corregir la entrega sin duplicar outputs. Mantener el cierre de llamadas bloqueadas por guardas, que usa errores locales y no fabrica efectos.
- Validar el lote completo de llamadas del proveedor antes de publicar historial/pending: catálogo, objeto de argumentos y call_id no vacío/único. Un elemento inválido posterior no deja un prefijo de llamadas pendiente de ejecución. Es validación local, no una transacción ni garantía sobre la red.
- No añadir verificación extra a cada modificación individual: alteraría latencia y semántica de éxito sin ser necesaria para corregir el alcance. Los ACK y el contexto del servicio acreditan esa operación, no un vaciado global.
- La paginación Gmail conserva next_page_token/likely_has_more/count como datos y retira su warning imperativo de seguir leyendo. Los tres ejecutores Gmail sanean excepciones inesperadas; las respuestas normales del servicio no se reescriben.

## Risks / Trade-offs

- Retirar el feedback puede hacer que una operación masiva incompleta termine antes → usar los resultados autoritativos de lotes/limpieza; no forzar efectos fuera de la solicitud. Probar conteos parciales intactos.
- Sidechannel aparece en muchos módulos → eliminación mecánica y búsqueda de referencias, typecheck y suites de ejecutores/loop/servicios/otros proveedores.
- El modelo puede proponer nuevas llamadas → siguen sujetas a permisos y HITL existentes; no afirmar un firewall semántico global por este cambio.
- Otro módulo runtime puede registrar contenido en history → esta unidad retira el logging del verificador; la redacción integral de historial se mantiene como deuda explícita separada.

## Migration Plan

Sin persistencia ni migración. Registrar baseline y reproducción del fallo, retirar el estado completo y sus fixtures, probar correspondencia de resultados/call_id, fallos, cancelación, grupo/confirmación, cambio de cuenta y ausencia de consultas extra. Ejecutar build aislado y verify:pr. Revertir como una unidad coherente reintroduciría el riesgo de feedback; preferir revertir a una versión segura sin el verificador, conservando las siete unidades previas. Revisión independiente pendiente antes de archivar.
