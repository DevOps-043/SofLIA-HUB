## Purpose

Definir que el usuario decide qué puede tocar cada Skill suya, y hasta dónde
llega esa decisión. Es la contraparte de la regla que impide a una fila del
catálogo concederse privilegios: aquí quien elige es el dueño, sobre su propia
Skill y con su sesión, así que puede elegir más — pero no puede elegir por
encima de la superficie, del canal ni de las confirmaciones.

## ADDED Requirements

### Requirement: El usuario elige las herramientas de cada Skill

El sistema SHALL permitir que el usuario seleccione, por Skill, qué herramientas
puede usar el modelo cuando esa Skill está activa. La selección SHALL persistirse
asociada al usuario y SHALL aplicarse en todas las superficies donde la Skill
esté disponible.

#### Scenario: Una Skill acotada solo ve lo elegido

- **WHEN** el usuario deja en una Skill únicamente las herramientas de correo y después la invoca
- **THEN** el modelo recibe solo esas herramientas y no puede abrir el navegador, tocar el calendario ni actuar sobre la computadora en ese turno

#### Scenario: Sin selección, nada cambia

- **WHEN** el usuario nunca ha configurado las herramientas de una Skill
- **THEN** la Skill dispone del mismo catálogo que tendría hoy, porque la ausencia de elección no retira capacidades

#### Scenario: La elección vale en los canales

- **WHEN** el usuario acota las herramientas de una Skill desde la aplicación y luego la invoca por WhatsApp o Telegram
- **THEN** el canal aplica la misma selección, sin reiniciar ni volver a vincular

### Requirement: La selección acota, nunca amplía

Una herramienta seleccionada SHALL concederse únicamente si la superficie ya la
ofrece y el canal la autoriza. El sistema MUST NOT conceder por selección del
usuario una herramienta que la superficie no expone, que la política del canal
prohíbe, o que el producto marca como no seleccionable.

#### Scenario: Se selecciona algo que la superficie no ofrece

- **WHEN** el usuario marca el control de la computadora para una Skill y la invoca desde un canal que no ofrece esa capacidad
- **THEN** el sistema no la concede en ese canal, ejecuta la Skill con el resto y deja constancia del descarte

#### Scenario: El canal no autoriza al remitente

- **WHEN** un remitente sin la capacidad necesaria invoca una Skill que tiene seleccionada una herramienta sensible
- **THEN** la autorización del canal decide y la invocación se rechaza, con independencia de lo que el propietario haya seleccionado

#### Scenario: Herramienta no seleccionable

- **WHEN** el usuario intenta seleccionar una herramienta que el producto no ofrece como elección por Skill
- **THEN** la interfaz no la presenta, y una selección que la incluya por otra vía se descarta al resolver

### Requirement: Elegir una herramienta no autoriza su uso por adelantado

Las confirmaciones que hoy exige una operación destructiva o irreversible SHALL
seguir exigiéndose aunque la herramienta esté seleccionada para la Skill.
Seleccionar es decidir **qué puede usar** la Skill, no aprobar **lo que haga**
con ello.

#### Scenario: Una Skill con ejecución de comandos seleccionada

- **WHEN** una Skill con la ejecución de comandos seleccionada intenta ejecutar uno
- **THEN** el sistema pide la confirmación que ya pedía antes de ejecutarlo

#### Scenario: Envío de correo desde una Skill que lo tiene seleccionado

- **WHEN** una Skill con el envío de correo seleccionado va a enviar un mensaje
- **THEN** el sistema pide confirmación antes de enviarlo

### Requirement: Las Skills pasivas heredan y pueden acotar más

Una Skill pasiva SHALL usar por omisión la selección de la Skill que ejecuta, y
SHALL admitir una selección propia que la sustituya. Una rutina que corre sin
nadie delante SHALL poder acotarse con independencia de cómo esté configurada la
Skill para uso interactivo.

#### Scenario: La rutina hereda

- **WHEN** el usuario programa una rutina sobre una Skill sin elegir herramientas para la rutina
- **THEN** la rutina se ejecuta con las herramientas seleccionadas para esa Skill

#### Scenario: La rutina acota más que la Skill

- **WHEN** el usuario deja en la rutina solo la lectura de correo, mientras la Skill tiene además el navegador
- **THEN** la ejecución programada solo dispone de la lectura de correo

#### Scenario: Rutina libre sin Skill

- **WHEN** la rutina no referencia ninguna Skill del catálogo y no declara herramientas
- **THEN** se ejecuta con el catálogo que corresponde a su superficie, sin acotar

### Requirement: La búsqueda web se decide aparte de las herramientas

El sistema SHALL ofrecer por Skill un ajuste de búsqueda web con tres estados:
automática, siempre y nunca. El ajuste MUST NOT presentarse como una herramienta
más, porque el proveedor no permite combinar la búsqueda con las herramientas en
una misma petición y el sistema resuelve esa incompatibilidad por su cuenta.

#### Scenario: Búsqueda web siempre

- **WHEN** una Skill tiene la búsqueda web fijada en «siempre» y el usuario la invoca con una petición que la heurística no habría enviado a buscar
- **THEN** el sistema realiza la búsqueda igualmente

#### Scenario: Búsqueda web nunca

- **WHEN** una Skill tiene la búsqueda web fijada en «nunca»
- **THEN** el sistema resuelve el turno con herramientas y sin buscar en la web, aunque la petición mencione noticias o fechas recientes

#### Scenario: Automática

- **WHEN** una Skill no fija el ajuste
- **THEN** el sistema decide como lo hace hoy, según la petición del usuario

#### Scenario: Una petición mixta

- **WHEN** una Skill con búsqueda web activa recibe un encargo que además exige una acción local
- **THEN** el sistema investiga y después ejecuta la acción, sin dar por hecha una acción que no realizó
