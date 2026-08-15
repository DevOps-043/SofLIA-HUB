## Purpose

Definir dónde viven las Skills pasivas y de quién son. Hasta ahora vivían en un
archivo local espejado en una fila global compartida por todos los usuarios de la
misma base, de modo que no había ni propiedad ni aislamiento: la última escritura
ganaba. Fija también qué papel le queda al archivo local, que sigue siendo
necesario para que las rutinas arranquen sin red.

## ADDED Requirements

### Requirement: Cada Skill pasiva pertenece a un usuario y a un perfil

El sistema SHALL persistir cada Skill pasiva asociada al usuario que la creó y al
perfil de canal al que corresponde. Un usuario MUST NOT poder leer, modificar ni
eliminar las Skills pasivas de otro usuario. Las reglas de un perfil SHALL poder
consultarse sin traer las de los demás.

#### Scenario: Aislamiento entre usuarios

- **WHEN** una sesión intenta leer o escribir una Skill pasiva que pertenece a otro usuario
- **THEN** la base de datos rechaza la operación y los datos ajenos permanecen intactos

#### Scenario: Dos usuarios en la misma base

- **WHEN** dos usuarios distintos programan rutinas y ambos guardan
- **THEN** cada uno conserva las suyas y ninguno pisa las del otro

#### Scenario: Reglas por perfil

- **WHEN** el usuario consulta las Skills pasivas de un perfil concreto
- **THEN** obtiene solo las de ese perfil, y las del perfil global no se mezclan con las de un contacto

### Requirement: El almacén local es caché de arranque, no fuente de verdad

El sistema SHALL conservar una copia local de las reglas del usuario activo para
poder levantar las programaciones al arrancar sin depender de la red. La base de
datos SHALL ser la fuente de verdad: cuando esté disponible, lo que diga manda
sobre la copia local.

#### Scenario: Arranque sin red

- **WHEN** la aplicación arranca y no puede consultar la base de datos
- **THEN** las Skills pasivas del usuario se levantan desde la copia local y siguen ejecutándose

#### Scenario: La base responde y difiere de la copia local

- **WHEN** la aplicación consigue leer la base de datos y su contenido difiere de la copia local
- **THEN** el sistema adopta lo que dice la base y actualiza la copia local

#### Scenario: Equipo nuevo

- **WHEN** el usuario inicia sesión en un equipo donde nunca había entrado
- **THEN** recupera sus Skills pasivas desde la base de datos, sin tener que volver a crearlas

### Requirement: La copia local no expone reglas de otro usuario

La copia local SHALL contener únicamente las reglas del usuario con sesión
activa. Al cambiar de usuario o cerrar sesión, el sistema MUST NOT dejar en
ejecución ni al alcance del siguiente usuario las programaciones del anterior.

#### Scenario: Cambio de usuario en el mismo equipo

- **WHEN** un usuario cierra sesión y otro la inicia en el mismo equipo
- **THEN** las Skills pasivas del primero dejan de ejecutarse y no aparecen listadas para el segundo

### Requirement: Migración desde el almacén compartido

Las reglas que existían en el almacén global compartido SHALL migrarse a su dueño
la primera vez que ese usuario inicie sesión tras la actualización, conservando
programación, propósito, perfil y canales. Una regla ya migrada MUST NOT
duplicarse en migraciones posteriores.

#### Scenario: Primera sesión tras actualizar

- **WHEN** el usuario que creó las rutinas inicia sesión por primera vez tras la actualización
- **THEN** sus Skills pasivas quedan registradas a su nombre y siguen ejecutándose con la misma programación y los mismos canales

#### Scenario: La migración se repite

- **WHEN** el proceso de migración vuelve a ejecutarse sobre reglas ya migradas
- **THEN** no se crean duplicados ni se altera lo ya guardado

#### Scenario: No se puede determinar el dueño

- **WHEN** una regla del almacén compartido no permite determinar a qué usuario pertenece
- **THEN** el sistema no la atribuye a nadie, la deja fuera de la migración y deja constancia para que un operador decida
