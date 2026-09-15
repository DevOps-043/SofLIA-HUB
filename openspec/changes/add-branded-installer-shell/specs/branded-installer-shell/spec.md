## Purpose

Ofrecer una instalación Windows propia de Pulse Hub, con identidad original y animación tridimensional, conservando seguridad y compatibilidad con el motor existente.

## ADDED Requirements

### Requirement: Ventana e identidad propias

La entrada de instalación SHALL mostrar una ventana independiente del asistente convencional, el logo original y la misma orbe animada e interactiva del producto, sin recrear su diseño.

#### Scenario: Primera apertura
- **WHEN** se abre el instalador de entrada
- **THEN** se muestra la interfaz propia con acción Instalar, destino y controles de ventana, sin instalar automáticamente.

#### Scenario: Movimiento reducido
- **WHEN** Windows desactiva animaciones o la persona las pausa
- **THEN** la escena permanece estática y todos los controles siguen funcionando.

#### Scenario: Interacción con la orbe original
- **WHEN** se arrastra la orbe, se usan flechas con foco o se hace doble clic
- **THEN** se puede girar y recentrar la misma geometría y materiales de SofLIA sin iniciar instalación ni solicitar micrófono.

#### Scenario: Motor gráfico no disponible
- **WHEN** no se puede cargar WebView2 o WebGL
- **THEN** se muestra un aviso explícito sin sustituir la orbe por una aproximación ni bloquear los controles de instalación.

### Requirement: Instalación consentida y verificable

El instalador SHALL ejecutar únicamente su motor embebido e íntegro tras consentimiento explícito, mostrar progreso medido o indeterminado y no declarar éxito ante un error.

#### Scenario: Paquete alterado
- **WHEN** el hash del motor extraído no coincide
- **THEN** se rechaza la instalación y no se ejecuta el archivo.

#### Scenario: Escritura en curso
- **WHEN** el motor está instalando
- **THEN** la ventana muestra estado activo sin porcentajes inventados, impide iniciar otro motor y no lo termina al intentar cerrar.

#### Scenario: Fallo del motor
- **WHEN** el motor termina con error
- **THEN** se muestra el fallo con su código y no se ofrece abrir la aplicación como si se hubiera instalado correctamente.

### Requirement: Compatibilidad de distribución y previsualización

El nuevo ejecutable SHALL conservar el artefacto y metadatos del actualizador; la previsualización SHALL ser incapaz de instalar.

#### Scenario: Empaquetado
- **WHEN** se construye la entrada visual
- **THEN** el EXE del actualizador conserva su contenido y hash y se genera un artefacto de entrada separado.

#### Scenario: Demostración segura
- **WHEN** se ejecuta la previsualización y se recorren sus estados
- **THEN** se identifica como demostración y no se escribe en el destino ni se ejecuta un instalador.
