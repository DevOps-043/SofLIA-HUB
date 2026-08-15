## Purpose

Definir que el proceso main actúa ante la base de datos **como el usuario que
inició sesión**, y no como un cliente anónimo. Sin eso, ninguna política que
dependa de la identidad puede aplicarse en los canales, que es justo donde el
producto promete respetar las decisiones del usuario. Fija también los límites
de custodiar una credencial fuera del renderer.

## ADDED Requirements

### Requirement: El proceso main opera con la identidad del usuario

Cuando exista una sesión iniciada, el proceso main SHALL consultar y escribir la
base de datos del Hub como ese usuario, de modo que las políticas por identidad
resuelvan igual que en el chat del Hub. Sin sesión, main SHALL operar como
cliente anónimo y MUST NOT acceder a datos de ningún usuario.

#### Scenario: Una Skill del catálogo llega a los canales

- **WHEN** existe una sesión iniciada y el usuario invoca por WhatsApp o Telegram una Skill que solo está declarada en la base de datos
- **THEN** el canal la resuelve y la ejecuta, con el mismo catálogo que el chat del Hub

#### Scenario: La elección de canales se aplica en el canal

- **WHEN** el usuario desactiva una Skill para WhatsApp desde la aplicación
- **THEN** el agente de WhatsApp deja de ofrecerla y de ejecutarla, sin reiniciar la aplicación ni volver a vincular el canal

#### Scenario: Sin sesión

- **WHEN** no hay ninguna sesión iniciada
- **THEN** el proceso main no obtiene datos de ningún usuario, y las capacidades que dependen de ellos se comportan como si no hubiera configuración, sin error bloqueante

### Requirement: Custodia del token de sesión

El proceso main SHALL almacenar la credencial de sesión cifrada con el
almacenamiento seguro del sistema operativo. La credencial MUST NOT registrarse
en los logs, MUST NOT devolverse al renderer por ningún canal IPC, y MUST NOT
incluirse en diagnósticos, informes de error ni telemetría.

#### Scenario: La credencial no aparece en los registros

- **WHEN** el proceso main aplica, restaura o refresca la sesión
- **THEN** el registro de diagnóstico deja constancia del hecho sin incluir el valor de la credencial

#### Scenario: El renderer no puede recuperar la credencial

- **WHEN** cualquier código del renderer consulta el estado de sesión del proceso main
- **THEN** recibe únicamente si hay sesión y de qué usuario, nunca la credencial

#### Scenario: El sistema no ofrece cifrado

- **WHEN** el almacenamiento seguro del sistema operativo no está disponible
- **THEN** el sistema no persiste la credencial en claro; la sesión dura lo que dure el proceso y se vuelve a pedir al reiniciar

### Requirement: La sesión sobrevive al reinicio y funciona sin ventana

El proceso main SHALL restaurar la sesión guardada durante el arranque, **antes**
de inicializar los servicios que consultan datos del usuario, para que los
agentes de canal funcionen sin ninguna ventana abierta. Una credencial caducada o
rechazada SHALL descartarse sin bloquear el arranque.

#### Scenario: Arranque en segundo plano

- **WHEN** la aplicación arranca sin mostrar ventana y llega la hora de una Skill pasiva
- **THEN** la rutina se ejecuta y se entrega con la identidad de su dueño, sin que el usuario haya abierto la aplicación

#### Scenario: La credencial guardada ya no vale

- **WHEN** al arrancar, la credencial almacenada está caducada o el servidor la rechaza
- **THEN** el sistema la descarta, arranca sin sesión, deja constancia y las capacidades que dependen de la identidad quedan inactivas hasta el siguiente inicio de sesión

### Requirement: Revocación al cerrar sesión

Al cerrarse la sesión, el proceso main SHALL borrar la credencial almacenada y
volver a operar como cliente anónimo de inmediato. MUST NOT quedar en memoria ni
en disco ninguna credencial utilizable tras el cierre.

#### Scenario: El usuario cierra sesión

- **WHEN** el usuario cierra sesión en la aplicación
- **THEN** el proceso main borra la credencial del disco, cierra la sesión de su cliente y deja de poder leer datos de ese usuario

#### Scenario: Cambio de usuario

- **WHEN** un usuario cierra sesión y otro la inicia en el mismo equipo
- **THEN** el proceso main opera con la identidad del nuevo usuario y MUST NOT devolver datos del anterior
