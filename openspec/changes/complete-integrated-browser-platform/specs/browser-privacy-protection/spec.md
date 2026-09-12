## Purpose

Reduce seguimiento y navegación maliciosa con controles transparentes, reversibles y configurables por sitio.

## ADDED Requirements

### Requirement: Protección contra rastreo
El navegador SHALL aplicar una política equilibrada por defecto que bloquee rastreadores conocidos, cookies de terceros invasivas, parámetros de seguimiento y técnicas de fingerprinting compatibles con la aplicación.

#### Scenario: Recurso bloqueado
- **WHEN** una solicitud coincide con una regla activa
- **THEN** se cancela y aumenta un contador local por categoría y sitio

### Requirement: Excepciones por sitio
El usuario SHALL poder consultar bloqueos y desactivar temporal o permanentemente categorías para el origen visible.

#### Scenario: Sitio incompatible
- **WHEN** el usuario desactiva protección para el sitio actual
- **THEN** la excepción se limita a ese origen y la página puede recargarse

### Requirement: Navegación segura
El navegador SHALL evaluar URLs, descargas y errores de certificado mediante proveedores configurables y bloquear protocolos, hosts o artefactos conocidos como peligrosos con una explicación saneada.

#### Scenario: Proveedor no disponible
- **WHEN** la reputación remota no responde
- **THEN** continúan las guardas locales y el navegador informa la degradación sin declarar la URL segura

#### Scenario: Aviso ligado a la pestaña
- **WHEN** la revisión devuelve una advertencia, bloqueo o degradación para la navegación vigente
- **THEN** la barra de la pestaña activa muestra un mensaje controlado, diferencia proveedor caído de sitio bloqueado y no ofrece bypass; cambiar de pestaña muestra su propio estado y una respuesta obsoleta no modifica avisos

#### Scenario: Documento nuevo sin revisión remota
- **WHEN** un enlace, redirección o cambio de documento lleva a otro destino sin consultar al proveedor
- **THEN** se reemplaza el dictamen anterior por la revisión local, sin heredar ni persistir reputación remota

#### Scenario: Proveedor no confiable o excesivo
- **WHEN** el proveedor redirige, tarda más del plazo total, devuelve un cuerpo excesivo o una respuesta inválida
- **THEN** se cancela la consulta y se conserva la decisión local; texto arbitrario del proveedor no llega a logs ni interfaz y un permiso remoto no reduce advertencias locales

#### Scenario: Destino privado o perfil efímero
- **WHEN** se navega en invitado o privado, a una IP literal, un nombre local o una página interna
- **THEN** no se consulta reputación remota; las guardas locales siguen vigentes

#### Scenario: Navegación reemplazada durante la revisión
- **WHEN** cambia la pestaña, documento, perfil o ventana durante una revisión pendiente, incluso al volver al contexto original
- **THEN** la revisión anterior no puede emitir una navegación ni publicar errores sobre otro destino

#### Scenario: Bloqueo local fuera de la barra
- **WHEN** una redirección, restauración, marco, popup o descarga apunta a un host localmente bloqueado
- **THEN** la guarda de sesión bloquea la solicitud aun con privacidad y empresa apagadas; reanudar y reintentar vuelve a verificar la política

#### Scenario: Certificado válido sin bypass
- **WHEN** Chromium entrega una verificación válida
- **THEN** se conserva su resultado sin aceptar certificados mediante un bypass que desactive Certificate Transparency; los errores se rechazan sin excepción renderer

#### Scenario: Reputación fuera de la barra
- **WHEN** una solicitud gobernada de marco, redirección, popup o descarga tiene un destino elegible para el proveedor remoto
- **THEN** se revisa antes del tráfico, se mantienen las guardas locales y se cancela si el contexto queda obsoleto; una caída del proveedor degrada sin declarar seguridad

#### Scenario: Intersticial sin escape
- **WHEN** una pestaña o ventana gobernada queda bloqueada
- **THEN** muestra una superficie main aislada sin scripts, Node, preload ni red, con cierre o página en blanco y sin bypass; no permite observación del agente detrás del aviso ni retirarlo sólo cambiando el fragmento de URL
