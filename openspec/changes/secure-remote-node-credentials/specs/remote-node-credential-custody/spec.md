## Purpose

Mantener credenciales y configuración de nodos bajo propietario autenticado, con persistencia cifrada recuperable y revocación al cambiar sesión.

## ADDED Requirements

### Requirement: Custodia cifrada por propietario
Los perfiles MUST almacenarse cifrados por propietario exacto con el llavero seguro del SO, versión y cuotas. MUST denegar fallback plano/cwd y acceso sin sesión. Un archivo privado existente, incluso inválido o vacío, MUST impedir reimportación desde el legado.

#### Scenario: Fallo de cifrado o archivo
- **WHEN** falta el llavero, falla guardar o el archivo es inválido
- **THEN** se rechaza sin publicar éxito, reemplazar datos válidos ni crear un perfil plano

### Requirement: Migración preservada sin reasignación implícita
Todo el legado admitido MUST conservarse cifrado antes de importar registros. Sólo nodos con propietario coincidente MUST restaurarse; host sin propietario y nodos huérfanos MUST requerir nuevo emparejamiento. MUST comunicarse el pendiente sin mostrar credenciales de otras cuentas.

#### Scenario: Perfiles mezclados
- **WHEN** una cuenta restaura un legado con nodos propios, ajenos y huérfanos
- **THEN** sólo recibe los propios, con host nuevo apagado, y el original completo queda preservado cifrado

### Requirement: Sesión vigente y mutación confirmada
Cada operación del servicio MUST derivar identidad main y revalidarla tras esperas, incluyendo A/B/A. Cambiar cuenta o cerrar sesión MUST invalidar inmediatamente transporte, revisiones y autoridad del host previo. Las mutaciones MUST serializarse y publicarse sólo después de guardar; un fallo previo a publicación atómica MUST conservar el estado anterior en RAM y disco. Un rename ya admitido MUST permanecer ligado al propietario original, sin promesa de reversión física.

#### Scenario: Guardado o carga tardíos
- **WHEN** cambia sesión durante carga, cifrado, guardado o transporte
- **THEN** no se publica estado bajo otra cuenta ni se sobrescribe una sesión posterior; cualquier rename ya admitido permanece ligado a su propietario original

### Requirement: Host vinculado a identidad
El host MUST permanecer apagado sin sesión y no admitir efectos ni publicar resultados tras revocación. Entradas HTTP MUST tener cuotas y revalidación tras leer cuerpos; las tareas MUST recibir señal de cancelación. Credenciales ya enviadas y efectos admitidos no MUST presentarse como físicamente revertidos.

#### Scenario: Revocación durante cuerpo o tarea
- **WHEN** se invalida la sesión del host durante una espera
- **THEN** no se admite un efecto nuevo ni se publica información privada desde ese contexto
