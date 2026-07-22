## ADDED Requirements

### Requirement: Instrumentación de arranque

El proceso principal SHALL registrar marcas de tiempo por fase de arranque
(`app.whenReady`, creación de ventana, primer pintado del renderer e
inicialización de cada grupo de servicios) mediante log estructurado en español,
sin exponer secretos ni datos personales.

#### Scenario: Arranque medido

- **WHEN** la aplicación arranca en cualquier modo
- **THEN** el proceso principal emite marcas con fase, tiempo relativo y duración
  suficientes para comparar antes/después sin reproducir el fallo

### Requirement: Ventana temprana sin destello

El proceso principal MUST crear la ventana principal antes de inicializar los
servicios no esenciales para el primer pintado, y SHALL mostrarla solo cuando su
contenido esté listo para pintarse, evitando un destello en blanco.

#### Scenario: Primer arranque visible

- **WHEN** el usuario inicia la app en modo visible
- **THEN** la ventana aparece con contenido pintado y sin destello en blanco, sin
  esperar a que terminen los servicios diferibles

#### Scenario: Fallback de visibilidad

- **WHEN** la señal de contenido listo no llega dentro de un tiempo acotado
- **THEN** la ventana se muestra de todos modos y el proceso registra la anomalía

### Requirement: Inicialización diferida de servicios no esenciales

El sistema SHALL ejecutar los servicios no esenciales para el primer pintado
después de que la ventana esté disponible, sin bloquear su aparición, y MUST
conservar el arranque de servicios con dependencias reales de los que dependa el
primer pintado.

#### Scenario: Servicios diferibles no bloquean la ventana

- **WHEN** la ventana ya puede pintarse
- **THEN** los servicios diferibles continúan inicializando en segundo plano sin
  retrasar la aparición ni la interacción inicial

#### Scenario: Reversión del orden

- **WHEN** la bandera de reversión está activa
- **THEN** el arranque restablece el orden serial anterior y la creación de
  ventana previa sin cambios de comportamiento adicionales

### Requirement: Coordinación de audio, pintura y visibilidad

El audio de intro MUST dispararse a partir de una señal única de renderer
listo/visible y no cuando la ventana está oculta.

#### Scenario: Sonido acompaña a la pintura

- **WHEN** el renderer señala que está listo y visible
- **THEN** el audio de intro inicia junto con la primera pintura, sin desfase
  perceptible atribuible al orden de arranque

#### Scenario: Ventana oculta en autostart

- **WHEN** la app arranca en modo `--background` con la ventana oculta
- **THEN** el audio de intro no se reproduce hasta que la ventana se vuelve
  visible

### Requirement: Presupuestos de arranque documentados

El sistema SHALL registrar en la documentación de parámetros de runtime los
presupuestos de tiempo hasta ventana visible y hasta primer pintado, y la
verificación MUST compararlos con mediciones reales antes y después del cambio.

#### Scenario: Presupuesto verificado con evidencia

- **WHEN** se cierra el cambio
- **THEN** existe una comparación antes/después basada en la instrumentación que
  respalda el presupuesto documentado, sin afirmar cifras no medidas
