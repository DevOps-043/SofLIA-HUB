# Límites de herramientas

## Desarrollo

Los agentes de desarrollo pueden leer el repositorio. Solo pueden modificar el
alcance autorizado, deben preservar trabajo ajeno y deben usar operaciones Git
recuperables. Requieren autorización explícita para publicar, enviar mensajes,
desplegar, borrar datos o cambiar sistemas externos.

## Runtime

Los agentes runtime reciben capacidades declaradas individualmente. Denegar por
defecto shell, Git, escritura arbitraria, borrado, credenciales y publicación.
Validar y sanear todos los argumentos en el proceso main. La interfaz del modelo
nunca sustituye la allowlist ni la autorización del usuario.

## Riesgo

- `read`: lectura local o remota dentro del alcance.
- `write`: mutación reversible; requiere confirmación cuando afecte terceros.
- `critical`: borrado, ejecución, envío, compra, despliegue o secretos; exige HITL.
