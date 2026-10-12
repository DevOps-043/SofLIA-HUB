## ADDED Requirements

### Requirement: Diseño legible predeterminado
El generador MUST aplicar jerarquía semántica, texto legible y espaciado
consistente en Word y PDF sin alterar el contenido entregado por el usuario.

#### Scenario: Encargo breve
- **WHEN** se genera un documento breve sin pedir portada
- **THEN** el título y el contenido comparten la primera página sin una portada vacía adicional

#### Scenario: Tabla con campos vacíos
- **WHEN** el contenido contiene una tabla con celdas vacías y columnas de distinta extensión
- **THEN** conserva las posiciones, ajusta los anchos y repite su encabezado al paginar

### Requirement: Personalización declarativa
Las herramientas MUST aceptar estilos y ajustes tipográficos acotados; las
preferencias explícitas del usuario o skill MUST prevalecer sobre el diseño
predeterminado sin permitir código o recursos externos.

#### Scenario: Skill con diseño propio
- **WHEN** una skill suministra un estilo, fuente y acento válidos
- **THEN** el archivo usa esos ajustes y conserva una petición explícita de portada

#### Scenario: Estilo no válido
- **WHEN** se suministra CSS, URL o una fuente no admitida como ajuste
- **THEN** se rechaza antes de escribir el documento
