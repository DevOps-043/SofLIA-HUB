## Purpose

Permite administrar el navegador en organizaciones sin convertir políticas remotas en ejecución arbitraria ni recopilar contenido sensible.

## ADDED Requirements

### Requirement: Políticas validadas
El navegador SHALL aceptar políticas versionadas para sitios, privacidad, extensiones, retención y agente; las entradas desconocidas o inválidas SHALL fallar cerradas y no conceder permisos.

#### Scenario: Política inválida
- **WHEN** una organización publica una política con campos o valores no soportados
- **THEN** el navegador conserva la última política válida y muestra diagnóstico

### Requirement: Precedencia visible
Las restricciones de organización SHALL prevalecer sobre preferencias personales y la interfaz SHALL indicar qué controles están administrados.

#### Scenario: Sitio bloqueado
- **WHEN** una política bloquea un origen
- **THEN** ni el usuario ni el agente pueden abrirlo desde ese perfil organizacional

#### Scenario: Privacidad administrada sin preferencia local activa
- **WHEN** la organización exige protección y el interruptor local de privacidad está apagado
- **THEN** la sesión instala la protección requerida, conserva el nivel más estricto y no permite excepciones locales que reduzcan la política

#### Scenario: Solicitud fuera de la barra de direcciones
- **WHEN** una navegación, marco, redirección o solicitud HTTP(S) intenta alcanzar un origen bloqueado
- **THEN** la guarda de sesión la cancela antes del envío, aunque proceda de historial, restauración o una ventana emergente; no reemplaza los interceptores de privacidad

#### Scenario: Política pendiente o perfil sustituido
- **WHEN** se solicita cambiar privacidad, agente o cargar una extensión mientras se verifica la política, o cambia el perfil durante esa espera
- **THEN** no se actúa antes de verificarla ni se publica o reutiliza la política del perfil anterior; un error de lectura mantiene el acceso administrado bloqueado

### Requirement: Telemetría saneada
La telemetría SHALL limitarse a métricas operativas, versión, estados y conteos agregados; MUST NOT incluir URLs completas, consultas, contenido, cookies, secretos ni capturas.

#### Scenario: Exportar diagnóstico
- **WHEN** un administrador autorizado exporta telemetría
- **THEN** recibe un artefacto saneado con periodo, esquema y origen de cada métrica

#### Scenario: Exportación local del perfil propio
- **WHEN** el titular autenticado solicita exportar el diagnóstico desde la ventana principal
- **THEN** main prepara una instantánea de esquema cerrado con versiones y conteos operativos, sin consultar historial ni bóveda, y solicita confirmación nativa con cancelar por omisión y destino JSON explícito

#### Scenario: Métricas sin datos navegados
- **WHEN** existen pestañas y descargas con datos sensibles
- **THEN** el reporte contiene sólo conteos y estados agregados con su fuente e instante de captura; no contiene identificadores, URLs, consultas, títulos, nombres de archivos, mensajes de error ni secretos, y no se envía a ningún proveedor

#### Scenario: Exportación cancelada u obsoleta
- **WHEN** se cancela, vence la revisión o cambia el perfil, la generación o la ventana antes de emitir la escritura definitiva
- **THEN** no se publica el archivo ni se autoriza otro perfil con el consentimiento anterior; destinos existentes se conservan sin sobrescritura
