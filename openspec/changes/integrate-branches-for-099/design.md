## Decisiones de integración

Base: main en 61cbadfea1a157984d9f2f47e9a035ee0e2f6fac, limpia y alineada con
origin/main. Rama de trabajo: codex/integrate-all-branches en el checkout actual.

La evolución más reciente de sesiones, equipos y navegador se toma desde
origin/codex/redesign-synchronous-sessions. Se fusionan Google Chat, diagnóstico
de cuentas, entrada multimodal y gestión de recursos con resolución explícita.
Las demás ramas recientes ya son antecesoras de estos extremos.

Las ramas AutoDev de febrero y marzo contienen prototipos sustituidos, fallos
registrados y código que ampliaría permisos o regresaría arquitectura. La
revisión adversarial independiente clasifica sus cambios; sus commits se
incorporan como padres de merges históricos conservando el árbol vigente.
No se afirma que se habiliten todas sus funciones antiguas. Dos arreglos aún
vigentes se adaptan a los módulos actuales con pruebas de regresión.

Se mantienen cancelación por petición, catálogo de herramientas filtrado,
protecciones de identidad, navegación sensible y recuperación del chat al
combinar las partes multimodales. La gestión de recursos conserva los eventos
de reinicio del renderer y las barreras de tareas supervisadas.

La documentación de usuario describe funciones implementadas y distingue el
prototipo local del aula de una sesión transmitida. El hook de subida de medios
grandes de la rama multimodal aún no está conectado al compositor actual; no
se anuncia como capacidad de adjuntos terminada.

## Recuperación

Se conserva la base 61cbadf y todos los commits originales. Antes de actualizar
main se ejecutan las verificaciones disponibles y se registra evidencia. El
retroceso debe realizarse mediante commits de reversión revisados, sin resetear
ni eliminar ramas. Un push a main activaría el workflow de release: queda fuera
de esta integración local, junto con firma, empaquetado y publicación.
