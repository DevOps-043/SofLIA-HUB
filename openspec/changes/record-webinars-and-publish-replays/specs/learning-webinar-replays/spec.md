## Purpose

Permitir al instructor habilitar repeticiones de webinars completos en Learning,
con control académico de audiencia y acceso independiente de la grabación obligatoria.

## ADDED Requirements

### Requirement: RF-WREP-001 Intención explícita de publicar
Las grabaciones SHALL ser privadas por defecto. El instructor autorizado SHALL
poder solicitar disponibilidad antes del evento o publicar una edición después
de revisarla. Una intención previa SHALL bastar cuando siga vigente; no SHALL
exigir confirmación redundante. Se publicará únicamente una edición íntegra de
evento finalizado, con rol/audiencia/intención revalidados en servidor.

#### Scenario: Instructor no solicita repetición
- **WHEN** una grabación termina y se importa correctamente
- **THEN** permanece privada y no aparece como reproducible para alumnos

#### Scenario: Instructor habilita antes del evento
- **WHEN** existe intención vigente autorizada y la edición final queda íntegra
- **THEN** se publica para la audiencia académica elegida sin una nueva confirmación innecesaria

#### Scenario: Evento en curso o edición incompleta
- **WHEN** hay intención de publicar pero falta fin o validación de segmentos
- **THEN** la UI muestra pendiente/procesando y no concede acceso de alumno al vídeo parcial

#### Scenario: Resultado con huecos o ensayo incluido
- **WHEN** la edición tiene interrupciones, cobertura incierta o material de ensayo
- **THEN** se conserva privada para revisión y la intención genérica anterior no
  publica ese resultado distinto automáticamente

### Requirement: RF-WREP-002 Acceso académico al vídeo
Learning SHALL conceder reproducción solo a actores con organización, curso y
membresía válidos para una edición publicada. SHALL usar entrega autorizada o URL
efímera tras revalidación, sin compartir enlaces de Zoom como sustituto de RLS.
El reproductor SHALL soportar seek y segmentos con errores visibles.
La configuración del proveedor SHALL impedir exposición automática del original
o enlaces on-demand que eludan la decisión del instructor y el acceso académico.

#### Scenario: Alumno autorizado
- **WHEN** un alumno con acceso académico vigente abre una repetición publicada
- **THEN** recibe reproducción privada de esa edición y puede avanzar entre sus segmentos

#### Scenario: Alumno ajeno, sesión privada o membresía revocada
- **WHEN** el actor no cumple el acceso para ese curso/organización/edición
- **THEN** no recibe catálogo privado, object key ni nuevas concesiones de reproducción

#### Scenario: Original compartido por el proveedor
- **WHEN** la configuración de Zoom expone automáticamente el vídeo a asistentes
- **THEN** el preflight detecta el bypass y no acredita privacidad de la repetición
  hasta corregir esa configuración con autorización administrativa

### Requirement: RF-WREP-003 Retiro y carreras de publicación
Retirar una repetición SHALL impedir nuevas concesiones; las URLs emitidas tendrán
vigencia acotada y declarada. Un job tardío o un webhook duplicado no SHALL revertir
una intención de retiro. Toda modificación SHALL validar actor y revisión y
registrar auditoría; borrar archivos requerirá autoridad adicional y HITL explícito.

#### Scenario: Retiro mientras termina la importación
- **WHEN** el instructor retira la intención antes de completar un job
- **THEN** la importación puede conservar el vídeo privado, pero no volver a publicarlo

#### Scenario: Instrucción de otro instructor
- **WHEN** un actor sin permiso de gestión intenta habilitar o retirar la repetición
- **THEN** el servidor rechaza la mutación sin modificar el acceso del curso
