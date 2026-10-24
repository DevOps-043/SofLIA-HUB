# Contexto

- Objetivo: eliminar la ampliación automática de alcance al modificar etiquetas Gmail desde WhatsApp y conservar resultados verificables del servicio.
- Problema confirmado: bulk-label-verification consulta toda una etiqueta después de modificar un solo mensaje, añade una orden de continuar hasta vaciarla y fabrica otra functionResponse gmail_modify_labels sin llamada correspondiente. Registra IDs/errores crudos.
- Actor: remitente autorizado por el runtime existente. Se mantienen controles de grupo, confirmación, sesión/owner de Gmail y permisos previos.
- Alcance: retirar consulta/feedback automático y su sidechannel bulkLabelsToVerify en loop/dispatch/executores Google. Entregar sólo los resultados reales de cada llamada, preservando orden, cardinalidad, parcialidad e incertidumbre.
- Decisión: lotes/limpieza ya verifican su resultado en el servicio. Una modificación individual confirma su propio efecto; no justifica verificar/vaciar toda la etiqueta ni crear otro framework de verificación.
- No objetivos: nuevos canales/servicios/permisos, cambiar catálogo, nuevo HITL global, diario de operaciones, garantizar que el modelo nunca proponga una acción futura o rediseñar el loop completo.
- Criterios: una respuesta por llamada, sin lecturas adicionales ni órdenes de vaciado; parcial/uncertain/cancelled intactos; guardas y hermanos Calendar/Drive/Chat siguen operando; remover todas las referencias activas al estado retirado; pruebas de loop y adaptador call_id, tipos/lint/build/gate.
- Restricciones: conservar las siete unidades previas y sus cambios; pruebas sólo con servicios/proveedor simulados, sin datos ni credenciales reales.
- Riesgo residual: el modelo puede proponer nuevas llamadas dentro de los permisos actuales; sus guardas/HITL siguen siendo la frontera de efectos, no una promesa del prompt.
