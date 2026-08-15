## Purpose

Definir cómo se le presentan al usuario unas noventa herramientas cuyos nombres
son identificadores internos (`gmail_get_messages`, `use_computer`). Sin una capa
que las agrupe y las nombre en su idioma, la configuración sería una lista
ilegible y el usuario elegiría a ciegas. Fija también la separación entre lo que
un usuario puede seleccionar y lo que una fila del catálogo puede declarar.

## ADDED Requirements

### Requirement: Registro presentable de herramientas

El sistema SHALL mantener un registro donde cada herramienta seleccionable tenga
un nombre y una descripción en español y pertenezca a un grupo de dominio. La
interfaz de configuración SHALL presentar las herramientas por grupo y MUST NOT
exigir al usuario conocer el identificador interno.

#### Scenario: El usuario configura por dominio

- **WHEN** el usuario abre la configuración de herramientas de una Skill
- **THEN** ve grupos como Correo, Calendario, Drive, Navegador o Computadora, cada uno con sus herramientas descritas en español, y puede activar o desactivar el grupo entero o piezas sueltas

#### Scenario: Una herramienta del runtime sin entrada en el registro

- **WHEN** el catálogo runtime ofrece una herramienta que el registro todavía no describe
- **THEN** la interfaz no la presenta como opción y el sistema la trata como no seleccionable, sin romper la configuración existente

#### Scenario: Una selección guardada nombra algo desconocido

- **WHEN** una selección guardada contiene un identificador que esta versión no reconoce
- **THEN** el sistema lo descarta al resolver y conserva el resto de la selección

### Requirement: Dos listas distintas para dos contextos de confianza

El sistema SHALL distinguir lo que un **usuario** puede seleccionar para su
propia Skill de lo que una **fila del catálogo** puede declarar. La lista del
usuario SHALL poder ser más amplia. La del catálogo MUST NOT ampliarse por este
mecanismo: una fila sigue sin poder concederse envío de correo, escritura sobre
el buzón, control de la computadora ni ejecución de comandos.

#### Scenario: El usuario selecciona lo que una fila no podría declarar

- **WHEN** el usuario selecciona el control de la computadora para una Skill del catálogo, en una superficie que lo ofrece
- **THEN** el sistema se lo concede, porque la decisión es del dueño de la Skill y de su equipo

#### Scenario: La fila intenta lo mismo

- **WHEN** la fila de esa misma Skill declara el control de la computadora entre sus herramientas
- **THEN** el sistema lo descarta, porque quien escribe la fila no es el dueño del equipo

#### Scenario: Marcar herramientas peligrosas

- **WHEN** la interfaz presenta una herramienta cuyo efecto no se deshace desde el chat
- **THEN** la señala como tal, de modo que el usuario sepa qué está concediendo antes de marcarla
