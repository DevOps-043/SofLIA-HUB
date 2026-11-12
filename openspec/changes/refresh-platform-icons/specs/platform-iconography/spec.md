## ADDED Requirements

### Requirement: Familia visual compartida
El renderer MUST reutilizar las siluetas de Proyectos para conceptos equivalentes del chat y navegación, con rellenos de color actual y sin añadir dependencias.

#### Scenario: Alternar tema
- **WHEN** se alterna entre tema claro y oscuro
- **THEN** los iconos heredan el color del control y conservan las siluetas y el contraste del tema.

### Requirement: Respuesta visual accesible
Los iconos MUST responder al hover, foco visible y pulsación del control, sin duplicar eventos ni cambiar su acción. MUST respetar movimiento reducido y controles deshabilitados.

#### Scenario: Usar cursor o teclado
- **WHEN** una acción habilitada recibe hover o foco visible y después se pulsa
- **THEN** el icono se eleva suavemente y se comprime durante la pulsación sin desplazar texto ni controles vecinos.

#### Scenario: Preferir movimiento reducido
- **WHEN** el sistema solicita reduced-motion
- **THEN** los dibujos permanecen estáticos durante hover, foco y pulsación.

#### Scenario: Acciones anidadas y controles bloqueados
- **WHEN** se pasa el cursor por una fila con botones secundarios o un botón deshabilitado por sí mismo o por fieldset
- **THEN** cada icono responde solamente a su control habilitado más cercano.
