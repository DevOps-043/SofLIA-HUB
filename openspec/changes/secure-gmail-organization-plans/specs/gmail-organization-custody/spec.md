## Purpose

Proteger los planes de organización del buzón mediante propiedad verificable y mantener evidencia recuperable de efectos confirmados, parciales e inciertos al aplicar o revertir cambios.

## ADDED Requirements

### Requirement: Plan privado y validado
El sistema MUST vincular cada plan al usuario Hub y cuenta Google exactos, cifrar su contenido sin fallback plano, validar IDs y esquema, acotar lectura y reemplazar archivos atómicamente. MUST conservar sin ejecutar los planes heredados sin propietario.

#### Scenario: Cuenta o ruta ajena
- **WHEN** se solicita un ID malformado, un archivo corrupto o un plan de otro usuario/cuenta
- **THEN** no se ejecuta el plan ni se escribe fuera de su directorio privado

### Requirement: Contexto y aprobación de organización
Los tres canales de planes MUST validar ventana registrada, frame principal, documento y sesión. Apply/undo MUST exigir confirmación nativa del plan y cuenta, invalidada por cambio de contexto, cancelación o caducidad. La ejecución MUST mantener un solo plan activo por cuenta y detener efectos nuevos al invalidarse la sesión.

#### Scenario: Cambio de sesión durante espera
- **WHEN** cambia actor/conexión o se cancela la aprobación
- **THEN** no se inicia el siguiente efecto remoto y se liberan listeners/bloqueos

### Requirement: Avance persistido y resultado honesto
Antes de cada efecto remoto, el sistema MUST persistir su intención. Después de confirmar, MUST registrar conteos y cambios reversibles. Un fallo MUST conservar los avances conocidos e indicar partial/uncertain/recoveryRequired según corresponda, sin anunciar cero cambios si hubo confirmaciones. Un plan completo repetido MUST devolver su resultado sin repetir efectos.

#### Scenario: Fallo tras un lote confirmado
- **WHEN** un lote posterior falla o se interrumpe el proceso dejando una intención pendiente
- **THEN** el plan conserva el avance anterior, declara recuperación necesaria y bloquea replay automático del efecto incierto

### Requirement: Reversión con precondiciones
Undo MUST actuar únicamente sobre cambios confirmados de un plan propio sin efectos pendientes. MUST comprobar las etiquetas actuales antes de revertir y conservar las etiquetas creadas que ya contengan otros mensajes. No MUST prometer una transacción o entrega exactamente una vez del proveedor.

#### Scenario: Estado remoto cambiado
- **WHEN** las etiquetas actuales de un mensaje difieren del estado que dejó el plan
- **THEN** se detiene la reversión antes de sobrescribir esa diferencia y se conserva el progreso anterior
