## ADDED Requirements

### Requirement: Lecturas iniciales ordenadas
El renderer SHALL esperar la publicación de sesión pendiente antes de consultar
el estado de proyectos, con espera acotada y sin relajar autorización en main.

#### Scenario: Validación de sesión lenta
- **WHEN** main todavía valida una publicación de sesión
- **THEN** proyectos espera la publicación o declara sesión pendiente de forma recuperable
- **AND** no adelanta una consulta que produciría un rechazo genérico

### Requirement: Restauración de conversaciones sin trabajo accesorio bloqueante
La restauración SHALL aceptar la sesión verificada sin esperar la escritura del
perfil y compartir un canje en curso para la misma identidad y credencial.

#### Scenario: Perfil lento
- **WHEN** la escritura del perfil no termina
- **THEN** la sesión de conversaciones queda disponible igualmente

### Requirement: Recuperación acotada y observable
La UI SHALL reintentar automáticamente la recuperación inicial de conversaciones
y los fallos recuperables de proyectos, sin solicitudes simultáneas ni ciclos
ilimitados, y mostrar error y reintento manual al agotar el presupuesto.

#### Scenario: Fallo transitorio
- **WHEN** el siguiente intento recupera los datos
- **THEN** desaparece el estado de espera sin exigir intervención manual

#### Scenario: Fallo persistente o desmontaje
- **WHEN** se agotan los intentos o se desmonta la vista
- **THEN** cesan los reintentos automáticos
- **AND** una vista montada conserva un error accionable
