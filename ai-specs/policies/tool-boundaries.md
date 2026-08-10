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

## Skills del producto

Una **Skill** es una capacidad runtime invocable, distinta de las skills de
desarrollo de este directorio y de la memoria aprendida de
`electron/memory/skills-*.ts`. No comparte permisos con ninguna de las dos.

- Las Skills del **sistema** se declaran en código versionado y pueden aportar
  herramientas; las del **usuario** solo aportan instrucciones y nunca habilitan
  una herramienta, aunque su texto lo pida.
- Una Skill activa lo que su superficie ya permite; nunca amplía lo que la
  superficie prohíbe. La allowlist vive en `src/shared/skills/surface-tools.ts`.
- Las herramientas de espacio de trabajo son `write` acotadas: operan solo
  dentro del workspace de la Skill activa, con rutas relativas validadas contra
  la raíz real en main, y no se declaran sin workspace vivo.
- Entregar el resultado por un canal externo es `critical` y exige HITL.

## Riesgo

- `read`: lectura local o remota dentro del alcance.
- `write`: mutación reversible; requiere confirmación cuando afecte terceros.
- `critical`: borrado, ejecución, envío, compra, despliegue o secretos; exige HITL.
