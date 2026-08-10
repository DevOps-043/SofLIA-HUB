## Purpose

Permite que una persona entre al escritorio con el mismo inicio de sesión federado que ya usa en SofLIA Learning, incluidas las cuentas creadas por Google o Microsoft que nunca definieron contraseña, sin que el escritorio manipule credenciales ni secretos del proveedor de identidad.

## ADDED Requirements

### Requirement: El escritorio delega la identidad sin tocar credenciales

El sistema SHALL ejecutar el paso de identidad en el navegador del sistema del usuario y MUST NOT recibir, solicitar, almacenar ni transmitir la contraseña del usuario ni el secreto de cliente del proveedor de identidad durante este flujo.

#### Scenario: Inicio del flujo federado

- **WHEN** el usuario elige continuar con SofLIA Learning desde la pantalla de inicio
- **THEN** el sistema abre el paso de identidad en el navegador del sistema y queda esperando el resultado sin bloquear la aplicación

#### Scenario: El usuario abandona el flujo

- **WHEN** el usuario cierra el navegador o no completa la identificación
- **THEN** el escritorio permanece sin sesión, no queda en espera indefinida y permite reintentar o usar el inicio por contraseña

#### Scenario: El navegador integrado no participa

- **WHEN** el sistema necesita mostrar la pantalla del proveedor de identidad
- **THEN** no la presenta dentro de una vista embebida de la aplicación

### Requirement: El resultado queda ligado a la instancia que inició el flujo

El sistema SHALL vincular criptográficamente el resultado del inicio federado a la instancia de escritorio que lo solicitó, y el backend MUST rechazar cualquier canje que no demuestre poseer el secreto generado por esa instancia. El sistema MUST tratar el canal de retorno del sistema operativo como no confidencial.

#### Scenario: Otra aplicación local intercepta el retorno

- **WHEN** una aplicación distinta registrada para el mismo esquema recibe el resultado e intenta canjearlo
- **THEN** el backend deniega el canje por no poder demostrar la posesión del secreto de la instancia solicitante, y no emite ninguna prueba de acceso

#### Scenario: Retorno sin correlación con una solicitud viva

- **WHEN** el escritorio recibe un resultado que no corresponde a una solicitud de inicio que él mismo haya emitido y siga vigente
- **THEN** lo descarta sin intentar canjearlo y no altera el estado de sesión

### Requirement: La prueba de retorno es de un solo uso y de vida corta

El sistema SHALL invalidar la prueba de retorno en su primer canje y SHALL rechazarla una vez superada su ventana de validez, que MUST ser breve. Dos canjes simultáneos de la misma prueba MUST resultar en a lo sumo una emisión de acceso.

#### Scenario: Reutilización de una prueba ya canjeada

- **WHEN** se presenta al backend una prueba que ya fue canjeada
- **THEN** el backend la rechaza sin emitir acceso, con independencia de que el resto de la solicitud sea válida

#### Scenario: Prueba expirada

- **WHEN** se presenta una prueba cuya ventana de validez ya venció
- **THEN** el backend la rechaza sin emitir acceso ni revelar si correspondía a una identidad real

#### Scenario: Canjes concurrentes de la misma prueba

- **WHEN** dos solicitudes canjean la misma prueba al mismo tiempo
- **THEN** a lo sumo una obtiene acceso y la otra es rechazada

### Requirement: El backend solo emite acceso para una identidad autenticada y autorizada

El backend SHALL derivar la identidad exclusivamente del estado de autenticación que él mismo estableció al completar el inicio federado, MUST NOT aceptar un identificador de usuario o correo enviado por el cliente, y MUST comprobar una membresía de organización activa antes de emitir cualquier prueba de acceso.

#### Scenario: Identidad autenticada con membresía activa

- **WHEN** el inicio federado se completa para una persona con al menos una membresía activa
- **THEN** el backend emite una prueba de acceso únicamente para el correo de esa identidad autenticada

#### Scenario: Identidad sin membresía activa

- **WHEN** el inicio federado se completa para una persona sin ninguna membresía activa
- **THEN** el backend deniega la emisión antes de generar cualquier prueba de acceso

#### Scenario: Identidad suspendida

- **WHEN** la persona autenticada tiene su acceso suspendido por un administrador
- **THEN** el backend deniega la emisión y el escritorio no abre sesión

#### Scenario: El cliente propone otra identidad

- **WHEN** una solicitud de canje incluye un correo o identificador distinto al de la identidad autenticada
- **THEN** el backend ignora el valor propuesto y resuelve siempre por la identidad autenticada

### Requirement: La sesión resultante es una sesión ordinaria de la identidad principal

El sistema SHALL producir una sesión de la identidad principal equivalente a la que produce el inicio por contraseña, SHALL conservar el identificador de usuario existente, y a partir de ella SHALL resolver perfil, organización y sesión operativa de conversaciones por el mismo camino que hoy, sin solicitar ninguna credencial adicional.

#### Scenario: Cuenta creada por SSO que nunca definió contraseña

- **WHEN** una persona cuya cuenta se creó por Google o Microsoft y no tiene contraseña completa el inicio federado
- **THEN** obtiene sesión en el escritorio con acceso a su perfil, su organización y sus conversaciones

#### Scenario: Cuenta que también puede iniciar con contraseña

- **WHEN** una persona que ya iniciaba sesión con contraseña usa en su lugar el inicio federado
- **THEN** obtiene la misma identidad, el mismo identificador de usuario y el mismo acceso a sus datos existentes

#### Scenario: Continuidad hacia la sesión de conversaciones

- **WHEN** la sesión de identidad principal queda establecida por esta vía
- **THEN** la sesión operativa de conversaciones se deriva automáticamente sin pedir una segunda credencial

### Requirement: El inicio por contraseña se conserva y la entrada federada es reversible

El sistema SHALL mantener disponible el inicio con usuario y contraseña sin cambios de comportamiento, y SHALL permitir deshabilitar la entrada federada mediante configuración sin publicar una versión nueva de la aplicación.

#### Scenario: Ambos caminos disponibles

- **WHEN** la entrada federada está habilitada
- **THEN** la pantalla de inicio ofrece las dos opciones y cualquiera de ellas produce una sesión equivalente

#### Scenario: Entrada federada deshabilitada

- **WHEN** la configuración deshabilita la entrada federada
- **THEN** la pantalla de inicio no la ofrece, el inicio por contraseña sigue funcionando y un retorno del sistema operativo para este flujo se ignora

### Requirement: Los fallos no dejan sesión a medias ni exponen detalles técnicos

El sistema SHALL cerrar cualquier sesión parcialmente establecida cuando la autorización falle, SHALL usar lenguaje comprensible sin nombres de servicios internos ni detalles del proveedor, y SHALL ofrecer reintentar ante fallos transitorios.

#### Scenario: Autorización denegada tras autenticar

- **WHEN** la identidad se autentica correctamente pero no está autorizada para el escritorio
- **THEN** el sistema informa que el acceso fue denegado, no deja ninguna sesión abierta y no revela la causa técnica

#### Scenario: Servicio de canje no disponible

- **WHEN** el canje falla por una causa transitoria de red o disponibilidad
- **THEN** el sistema muestra un mensaje no técnico, no deja sesión abierta y permite reintentar el inicio

#### Scenario: Reintento exitoso

- **WHEN** el usuario reintenta después de recuperarse el servicio
- **THEN** completa el inicio sin volver a pasar por una configuración manual

### Requirement: Los secretos y las pruebas de acceso permanecen confinados

El sistema MUST mantener toda clave administrativa fuera de la aplicación de escritorio y MUST NOT registrar ni persistir la prueba de retorno, el secreto de la instancia solicitante ni la prueba de acceso emitida.

#### Scenario: Ejecución del escritorio

- **WHEN** el escritorio ejecuta este flujo
- **THEN** no contiene ni recibe una clave administrativa y todas sus consultas posteriores siguen limitadas por las políticas de acceso por fila

#### Scenario: Registro de diagnóstico

- **WHEN** el sistema registra el resultado de un inicio federado
- **THEN** el registro permite distinguir éxito de fallo sin incluir la prueba de retorno, el secreto de la instancia, la prueba de acceso ni el correo del usuario

#### Scenario: Transporte de la prueba de acceso

- **WHEN** el backend responde a un canje exitoso
- **THEN** devuelve únicamente lo indispensable para abrir la sesión, con cabeceras que impiden su almacenamiento en caché, y el escritorio lo consume de inmediato
