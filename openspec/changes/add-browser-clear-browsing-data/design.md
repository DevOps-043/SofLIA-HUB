## Context

Todo lo necesario ya existía disperso. La partición por usuario vive en `profile-scope.ts`; el borrado de partición (`clearStorageData`, `clearCache`, `clearAuthCache`) ya se usa al purgar el perfil sin sesión; el historial es un JSONL nuestro con `visitedAt`; la bóveda y los permisos por sitio son archivos del perfil. Lo que faltaba era una superficie que los orquestara y un contrato honesto sobre qué se puede acotar y qué no.

## Goals / Non-Goals

Objetivos:

- Paridad de ergonomía con el diálogo de Chrome: categorías, intervalo, confirmación.
- Borrado acotado al perfil del usuario con sesión activa.
- Un resumen que permita verificar lo ocurrido en lugar de un "listo" opaco.

No objetivos:

- Tocar marcadores o extensiones, que Chrome tampoco borra aquí.
- Exponer el borrado al agente runtime. Es destructivo y dirigido por el usuario.
- Cerrar o recargar pestañas tras el borrado.

## Decisions

### El intervalo solo se aplica al historial, y la interfaz lo dice

Es la decisión que gobierna el resto. Chromium sabe acotar el borrado por fecha —`BrowsingDataRemover` lo hace internamente— pero **Electron 43 no lo expone**: `ClearDataOptions` admite `dataTypes`, `origins`, `excludeOrigins`, `avoidClosingConnections` y `originMatchingMode`, y nada más. Tampoco sirve filtrar a mano: el objeto `Cookie` de Electron no trae fecha de creación.

El historial sí puede acotarse porque es nuestro y cada visita guarda `visitedAt`.

Ante eso había tres salidas. Quitar el selector empobrece el caso más frecuente, que es "limpia lo de la última hora". Mostrar el selector y aplicarlo solo donde se puede, sin decirlo, es mentirle al usuario sobre lo que acaba de pasar con sus cookies. La tercera —la elegida— es ofrecer el selector y **declarar el alcance**: cada categoría que no puede acotarse marca `ignoredRange`, la casilla lo advierte al marcarse, un aviso lo explica una vez, y el resumen posterior repite "sin acotar al intervalo" en las categorías afectadas.

### Cinco categorías, con las avanzadas incluidas

Historial, cookies y datos de sitios, y caché son las tres de la pestaña básica de Chrome. Contraseñas y permisos por sitio son de su pestaña avanzada, y aquí importan más que allí: la bóveda y los permisos son archivos del perfil que hoy solo se editan de uno en uno desde sus paneles. Sin una vía de vaciado completo, "limpiar el navegador" quedaba a medias.

`cache` se separa de `cookies` en la llamada a `clearData` a propósito: son dos casillas distintas y el usuario suele querer una sin la otra.

### La caché de autenticación va con la caché

`clearCache()` no basta: una sesión Basic o NTLM sigue viva en la caché de autenticación aunque las cookies ya no estén. La categoría "archivos en caché" llama también a `clearAuthCache()`, que es lo que hace que el resultado se parezca a lo que el usuario esperaba.

### Fallo aislado por categoría

Cada categoría corre en su propio `try`. Un error borrando cookies no puede impedir que se borre el historial, y el resumen dice exactamente cuál falló y por qué. La alternativa —abortar al primer fallo— deja al usuario sin saber qué se borró y qué no, que es el peor estado posible en una operación destructiva.

### El orquestador recibe sus dependencias

`clearBrowsingData` no importa `electron` ni los almacenes: recibe cinco funciones y un reloj. El servicio las cablea con la partición del perfil activo. Así la lógica de categorías, intervalo y degradación se prueba sin Electron, y el único punto que necesita un entorno real es el cableado.

### HITL en el renderer, validación en main

La confirmación la da el usuario en `BrowserConfirmDialog`, igual que ya hacen "Borrar historial" y "Eliminar credencial". Main no confía en eso: `validateBrowsingDataRequest` rechaza categorías desconocidas, intervalos desconocidos y listas vacías antes de tocar nada, y el handler verifica el emisor como el resto del contrato del navegador.

## Risks / Trade-offs

- **El usuario puede creer que el intervalo se aplicó a todo.** Es el riesgo central y se mitiga en tres sitios: la casilla, el aviso y el resumen. No se puede eliminar sin que Electron exponga el rango de Chromium.
- **Las pestañas abiertas quedan con estado inconsistente.** Una página ya cargada sigue en pantalla con su sesión muerta hasta la siguiente petición. Chrome se comporta igual; recargar por nuestra cuenta sería más intrusivo que útil.
- **Vaciar la bóveda es irreversible y no hay exportación.** Se advierte en el diálogo. La casilla no viene marcada por omisión.
- **El conteo de cookies y caché no existe.** `clearData` no informa cuántos elementos quitó, así que el resumen dice "borrado" sin número. Inventar una cifra sería peor.

## Migration Plan

Aditivo: un canal nuevo, una pestaña nueva y tres métodos nuevos en almacenes existentes. Ningún contrato vigente cambia de forma. `BrowserSitePermissionStore.clear()` se conserva junto al nuevo `clearAll()` para no alterar a sus llamadores.

Rollback: retirar la entrada del menú y la pestaña deja el resto inerte; el canal sin superficie no se invoca. No hay datos que migrar ni estado persistido nuevo.
