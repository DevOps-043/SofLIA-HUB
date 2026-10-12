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

### Requirement: Portal coherente con la cámara
El sistema MUST proyectar la máscara y aro de transición con la cámara del plano saliente y revisar un fotograma intermedio.

#### Scenario: Panorámica con desplazamiento y escala
- **WHEN** la panorámica termina con una cámara admitida distinta de la identidad
- **THEN** el portal entrante conserva el centro y radio proyectados del aro saliente

### Requirement: Masterización medida sin aplanamiento dinámico innecesario
El sistema MUST medir el AAC final, aplicar ganancia y limitación de picos antes del render y reportar el rango de sonoridad medible.

#### Scenario: AAC fuera del perfil
- **WHEN** el AAC excede el pico o la tolerancia de sonoridad
- **THEN** reajusta dentro del límite de intentos y falla sin publicar si no alcanza el perfil

### Requirement: Evaluación autónoma trazable
La evaluación MUST utilizar el loop y servicios reales, identificar el runtime y distinguir casos fallidos sin persistir bundles con configuración privada.

#### Scenario: Manifiesto válido sin MP4 final
- **WHEN** existe film.json pero la producción no tiene MP4 y QA válidos
- **THEN** el caso falla y el diagnóstico no solicita un deck ni declara el video terminado

#### Scenario: Informe QA con muchos eventos
- **WHEN** el informe audiovisual protegido excede el presupuesto de contexto por su sangrado
- **THEN** la lectura hacia el modelo compacta JSON con representación reversible de eventos sin perder mediciones y conserva el archivo original

### Requirement: Pulido compatible de texto y transiciones
El sistema MUST conservar tiempos y contenido de manifiestos previos, separar la salida y entrada de sus titulares y admitir destacados literales opcionales con contraste legible.

#### Scenario: Destacado ajeno al mensaje
- **WHEN** un destacado no coincide con palabras completas del mensaje o colorea todo el titular
- **THEN** el manifiesto se rechaza con un error reparable

#### Scenario: Cambio de plano
- **WHEN** una escena entra mediante transición
- **THEN** su titular aparece después de desaparecer el titular anterior, con movimiento ligado a fotogramas

### Requirement: Fraseo y suspensión musical
La partitura MUST conservar sincronía, duración y perfil de masterización y separar el pulso rítmico de la pausa previa al cierre.

#### Scenario: Resolución final
- **WHEN** comienza el cierre de marca
- **THEN** la percusión y arpegios dejan espacio a la transición y la armonía final entra al terminarla

### Requirement: Composición cálida sin alteración del video
La nueva partitura MUST compartir el reloj de escenas, usar piano sintético amortiguado y armonía sostenida y conservar los límites de audio y duración.

#### Scenario: Sustitución de música del ejemplo aprobado
- **WHEN** se reemplaza únicamente la banda sonora
- **THEN** el MP4 mantiene los mismos paquetes de video y una pista AAC medida de la duración solicitada
