## ADDED Requirements
### Requirement: Dock compacto de escenas
El estudio MUST mantener escenas accesibles debajo de un único monitor, mediante filas compactas sin tarjetas grandes. El dock de escenas ocupa todo el ancho; no se muestra el apartado informativo Fuentes.
El aula MUST omitir el bloque informativo de grabación automática para instructor y participante, sin modificar la política de grabación o repetición del servidor.
#### Scenario: Pantalla de escritorio
- **WHEN** el instructor abre el estudio a 1280×720 con cuatro escenas
- **THEN** ve el monitor y las cuatro escenas sin desplazar el escenario

### Requirement: Cambios directos sin transiciones configurables
El estudio MUST eliminar controles de efectos, duraciones, contenido intermedio y el aviso de pantalla preparada.
#### Scenario: Cambio durante la emisión
- **WHEN** la salida está activa y el instructor selecciona otra escena
- **THEN** el programa cambia mediante corte y conserva la pista de salida
#### Scenario: Fuente no disponible
- **WHEN** no se puede cargar la escena seleccionada
- **THEN** se conserva el programa anterior y se muestra el error
