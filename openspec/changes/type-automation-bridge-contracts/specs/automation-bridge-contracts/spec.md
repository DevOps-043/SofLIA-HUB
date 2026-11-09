## Purpose

Mantener contratos de datos coherentes entre main, preload y renderer para las APIs de automatización, detectando deriva de tipos y respuestas remotas estructuralmente inválidas.

## ADDED Requirements

### Requirement: Contratos canónicos sin escape any
Las tres APIs públicas MUST compartir firmas y DTO puros sin any ni imports runtime de Electron en renderer. Los canales, argumentos válidos y resultados existentes MUST conservarse, salvo la proyección de credenciales conversacionales definida abajo. Los campos dinámicos MUST tratarse como unknown hasta comprobarlos; las opciones IPC de tareas MUST excluir AbortSignal interno.

#### Scenario: Compatibilidad de recorrido
- **WHEN** un consumidor invoca una operación válida por el preload tipado
- **THEN** llegan al handler los mismos argumentos y la respuesta válida conserva su formato

#### Scenario: Deriva de tipos
- **WHEN** un consumidor usa argumentos incompatibles o asume tipos no comprobados de campos dinámicos
- **THEN** la verificación de tipos detecta el desajuste sin casts any o supresiones nuevas

### Requirement: Frontera de datos remotos
Los valores JSON remotos MUST comprobarse como objetos antes de acceder a campos o actualizar metadata. Listas de capacidades MUST contener sólo strings para reemplazar metadata; las capacidades futuras válidas MUST conservarse. El texto no JSON MUST conservar su sobre legacy, sin interpretarlo como metadata.

#### Scenario: JSON no objeto
- **WHEN** un nodo responde JSON null, array o primitivo
- **THEN** la operación rechaza esa estructura sin corromper metadata ni tratarla como respuesta válida

#### Scenario: Metadata inválida o extensible
- **WHEN** una respuesta contiene capacidades mezcladas con valores no textuales, o capacidades futuras válidas
- **THEN** la lista inválida no reemplaza metadata y las capacidades textuales futuras se conservan

Tipar estos contratos no sustituye autorización nativa, HITL, aislamiento de propietarios o custodia de credenciales.

### Requirement: Proyección de credenciales en herramientas conversacionales
Las herramientas de estado/listado/registro de nodos MUST retirar el campo token del host y de registros antes de entregar resultados al modelo, tanto en main/WhatsApp como en herramientas del renderer. MUST conservar metadata y comunicar sólo si la credencial está configurada. La API manual de ajustes MUST conservar sus campos para el emparejamiento existente.

#### Scenario: Estado o registro para el modelo
- **WHEN** una herramienta conversacional consulta o configura el host, lista nodos o registra uno
- **THEN** su resultado no incluye el campo token y sí token_configured, sin modificar el registro original ni la API manual
