## Purpose

Conservar evidencia operativa de las herramientas WhatsApp sin persistir argumentos, mensajes privados ni errores crudos, manteniendo control de ciclos y resultados funcionales.

## ADDED Requirements

### Requirement: Historial operativo mínimo
Los eventos kind:tool MUST proyectarse a campos permitidos de estado, flags, conteos y correlación antes de persistir o devolverlos. MUST NOT incluir argumentos, mensajes, errores crudos, session_id, text/media ni metadata arbitraria. Registros tool heredados MUST proyectarse al leer sin reescribir sus bytes.

#### Scenario: Datos privados en la entrada o legado
- **WHEN** el productor o archivo heredado incluye texto privado en argumentos/respuestas/metadata
- **THEN** el nuevo registro o salida pública omite ese contenido y conserva los campos operativos permitidos

### Requirement: Comparación privada y avance
Las firmas de llamadas/resultados MUST ser huellas efímeras por turno sin payload en trace ni firma persistida. El control MUST distinguir cambios de progreso y conservar respuestas originales de herramientas.

#### Scenario: Avance parcial entre iteraciones
- **WHEN** una respuesta cambia sus conteos o flags de progreso
- **THEN** la firma cambia y el resumen conserva el avance sin guardar contenido privado

### Requirement: Fallos aislados y saneados
Una excepción inesperada de dispatcher/fallback/guarda MUST producir un error fijo correlacionable sin payload/stack. Una guarda fallida MUST impedir ejecutar la herramienta. Fallar el registro después de efectos MUST NOT alterar el resultado ni repetir efectos.

#### Scenario: Registro falla tras un efecto confirmado
- **WHEN** recordHistory lanza o rechaza después de ejecutar una herramienta
- **THEN** se conserva resultado/trace, se registra el fallo saneado y no se vuelve a ejecutar
