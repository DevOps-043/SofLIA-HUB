## Purpose

Definir que el usuario decide **dónde** vive cada capacidad de SofLIA: en
WhatsApp, en Telegram, en su computadora, o en varios a la vez. Cubre tanto la
disponibilidad de una Skill activa en un canal como el destino de la entrega de
una Skill pasiva, y fija que esa elección es del usuario, se guarda con su
identidad y la respetan por igual el Hub y los agentes de canal.

## ADDED Requirements

### Requirement: Canales de una Skill

El sistema SHALL reconocer tres canales de activación —WhatsApp, Telegram y
Computadora— y SHALL permitir que el usuario active o desactive cada Skill en
cada canal de forma independiente. Un canal MUST NOT ofrecerse para activación
si la Skill no declara esa superficie en el catálogo: la elección del usuario
acota lo que el catálogo permite, nunca lo amplía.

#### Scenario: El usuario activa una Skill solo en un canal

- **WHEN** el usuario activa una Skill en Computadora y la desactiva en WhatsApp y Telegram
- **THEN** la Skill se ofrece e invoca desde la aplicación, y los agentes de WhatsApp y Telegram no la ofrecen ni la ejecutan

#### Scenario: El catálogo no declara un canal

- **WHEN** una Skill del catálogo no declara la superficie de Telegram
- **THEN** la interfaz no ofrece activar ese canal para esa Skill, y activarlo por cualquier otra vía no la hace disponible allí

#### Scenario: Sin elección explícita

- **WHEN** el usuario nunca ha configurado los canales de una Skill
- **THEN** la Skill está disponible en todos los canales que su catálogo declara, porque la ausencia de elección no retira una capacidad

### Requirement: La elección de canales se guarda con la identidad del usuario

La elección de canales SHALL persistirse asociada al usuario en la instancia
Pulse Hub, de modo que la resuelvan igual el chat del Hub y los agentes de
canal, que corren en procesos distintos. Un usuario MUST NOT poder leer ni
escribir la configuración de canales de otro usuario.

#### Scenario: La elección viaja entre superficies

- **WHEN** el usuario desactiva una Skill en WhatsApp desde la configuración de la aplicación
- **THEN** el agente de WhatsApp deja de ofrecerla sin necesidad de reinstalar, reiniciar la vinculación ni reiniciar la aplicación

#### Scenario: Aislamiento entre usuarios

- **WHEN** una sesión intenta leer o modificar la configuración de canales de otro usuario
- **THEN** la base de datos rechaza la operación y la configuración ajena permanece intacta

#### Scenario: La base de datos no responde

- **WHEN** la consulta de la configuración de canales falla
- **THEN** el sistema resuelve las Skills con los canales que declara el catálogo, sin dejar al usuario sin capacidades ni mostrar un error bloqueante

### Requirement: Canales de entrega de una Skill pasiva

Una Skill pasiva SHALL declarar en qué canales entrega su resultado, y el
sistema SHALL entregarlo en todos los declarados. Una entrega fallida en un
canal MUST NOT impedir la entrega en los demás. Una Skill pasiva sin ningún
canal activo MUST NOT ejecutarse en silencio: el sistema SHALL advertirlo al
guardarla.

#### Scenario: Entrega en un solo canal

- **WHEN** una Skill pasiva programada a las 8:00 declara únicamente WhatsApp y llega su hora
- **THEN** el usuario recibe el resultado como mensaje de WhatsApp y la orbe no aparece

#### Scenario: Entrega en varios canales

- **WHEN** una Skill pasiva declara Computadora y Telegram y llega su hora
- **THEN** la orbe aparece y locuta el resultado, y además llega el mensaje por Telegram

#### Scenario: Un canal falla

- **WHEN** al entregar, el canal de WhatsApp está desconectado y el de Telegram disponible
- **THEN** el sistema entrega por Telegram, deja constancia del fallo de WhatsApp y no reintenta indefinidamente

#### Scenario: Skill pasiva sin canales

- **WHEN** el usuario intenta guardar una Skill pasiva sin ningún canal de entrega activo
- **THEN** el sistema advierte de que el resultado no llegaría a ninguna parte y no la deja activa sin destino

### Requirement: El canal no amplía las guardas de la superficie

Activar una Skill en un canal MUST NOT concederle en ese canal herramientas,
datos ni permisos que la superficie no concede por sí misma. Las guardas ya
vigentes de cada canal —bloqueo en grupos, autorización del remitente y
allowlist de herramientas— SHALL aplicarse por encima de la elección del
usuario.

#### Scenario: Una Skill bloqueada en grupos activa en un canal

- **WHEN** el usuario activa en WhatsApp una Skill marcada como bloqueada en grupos y alguien la invoca desde un grupo
- **THEN** el sistema la rechaza en el grupo y explica que debe pedirse por privado

#### Scenario: Un remitente no autorizado

- **WHEN** un remitente sin principal resuelto invoca una Skill activa en su canal
- **THEN** el sistema aplica la autorización del canal y rechaza la invocación, con independencia de la configuración de canales del propietario
