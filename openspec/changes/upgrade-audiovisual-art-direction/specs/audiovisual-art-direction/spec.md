## ADDED Requirements

### Requirement: Composición audiovisual semántica
El sistema MUST reproducir textos, layouts, contenido y movimiento declarados en el proyecto mediante un único motor compartido entre preview y MP4.

#### Scenario: Evolución de un curso
- **WHEN** el proyecto declara un curso que pasa a una interfaz de aprendizaje
- **THEN** los módulos conservan identidad y la composición muestra contenido y estados propios de cada interfaz

### Requirement: Revisión visual de la revisión actual
El sistema MUST ofrecer capturas de escenas y transiciones al modelo y comprobar geometría y tipografía antes de publicar la pieza.

#### Scenario: Composición superpuesta
- **WHEN** el contenido esencial se superpone o sale del área segura
- **THEN** la exportación falla con incidencias reparables

### Requirement: Reproducción estable
El sistema MUST conservar el reproductor audiovisual mientras se escriben archivos documentales que no cambian la película.

#### Scenario: Decisiones posteriores al render
- **WHEN** el agente actualiza decisiones.md durante la reproducción
- **THEN** el video conserva su tiempo y puede llegar al último fotograma
