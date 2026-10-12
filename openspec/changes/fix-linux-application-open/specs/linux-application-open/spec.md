## ADDED Requirements

### Requirement: Apertura Linux sin shell
El sistema SHALL resolver nombres instalados y lanzar la aplicación sin usar shell.

#### Scenario: Firefox instalado en PATH o como Snap
- **WHEN** el usuario solicita abrir Firefox
- **THEN** se resuelve su ejecutable o entrada desktop y se intenta un solo lanzamiento

#### Scenario: Aplicación inexistente o fallo de lanzamiento
- **WHEN** no existe una coincidencia instalada o el launcher falla
- **THEN** el resultado indica fallo y el chat no anuncia éxito

### Requirement: Evidencia de apertura
El sistema SHALL distinguir lanzamiento aceptado y ventana verificada.

#### Scenario: Sesión Wayland
- **WHEN** el launcher acepta la apertura pero no hay verificación de ventana soportada
- **THEN** se informa ese límite con window_verified=false sin afirmar éxito visual

#### Scenario: Sesión X11
- **WHEN** aparece una ventana perteneciente a la aplicación
- **THEN** se activa y se devuelve window_verified=true

### Requirement: Orden simple determinista
El chat SHALL ejecutar open_application para una orden explícita de Computer Use
que sólo solicita abrir una aplicación y SHALL responder desde el resultado real.

#### Scenario: Solicitud reportada
- **WHEN** llega «usa el computer use y abre firefox» con la herramienta disponible
- **THEN** se ejecuta una sola llamada y la respuesta refleja su evidencia

#### Scenario: Orden compuesta o catálogo restringido
- **WHEN** la solicitud contiene más acciones o el catálogo no permite open_application
- **THEN** no se toma el atajo determinista ni se amplían permisos
