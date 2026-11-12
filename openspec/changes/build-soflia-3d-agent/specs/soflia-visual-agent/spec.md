## ADDED Requirements

### Requirement: Modelo editable y reproducible
El sistema SHALL generar primero la base estática A seleccionada en una escena Blender
nueva, con siete vistas neutras y comparación frontal. Tras aprobar la geometría,
las fases posteriores podrán producir los proyectos y seis clips STATE_* solicitados.

#### Scenario: Silueta A seleccionada
- **WHEN** el usuario selecciona A — Núcleo horizontal entre las propuestas grises
- **THEN** se construye un cuerpo nuevo continuo con visor integrado, sin reutilizar
  las mallas V2–V5 ni avanzar animación, materiales de marca o integración web

#### Scenario: Generación local
- **WHEN** se ejecuta el generador con Blender compatible
- **THEN** produce archivos verificables, métricas y referencias identificadas por hash

### Requirement: Acabado de la base A
El sistema SHALL mantener la silueta A al aplicar el acabado marino y turquesa,
integrar los flujos en el cuerpo y conservar el logotipo original verificable.

#### Scenario: Continuar los acabados
- **WHEN** el usuario solicita acabado premium similar a la referencia cromática
- **THEN** se generan una escena nueva y siete vistas sin resplandor de posproducción,
  se preserva la base gris y no se modifican interfaz, controles ni animaciones

### Requirement: Control visual desacoplado
El sistema SHALL ofrecer seis estados, mirada, parpadeo, audio y perfiles de calidad.

#### Scenario: Reproducción y transición
- **WHEN** el integrador solicita un estado válido
- **THEN** AnimationMixer hace una transición y éxito/advertencia regresan a espera

#### Scenario: Ausencia de WebGL o movimiento reducido
- **WHEN** falla WebGL o el usuario pide movimiento reducido
- **THEN** se muestra fallback o pose estática sin bucle animado continuo

### Requirement: Entrega honesta
El sistema SHALL registrar verificaciones estructurales, visuales y de rendimiento reales.

#### Scenario: Exportaciones multimedia
- **WHEN** se generan GIF, WebM y PNG
- **THEN** se verifica resolución, duración y alfa sin atribuir capacidades no medidas
