# Verificación de la primera entrega

Ejecución del 17 de noviembre de 2026. Alcance implementado en Architect, Academy y Hub para transportar bloques, tiempos y notas privadas del ponente.

## Resultados

| Comprobación | Resultado |
| --- | --- |
| Architect, test:course-delivery | 26 pruebas aprobadas. |
| Academy, engine-conduction, engine-preparation, studio-boundaries y ruta HTTP studio | 25 pruebas aprobadas. |
| Hub, StudioConductionPanel, live-studio-domain y frontera HTTP main | 33 pruebas aprobadas. |
| Typecheck de Architect | Aprobado. |
| Typecheck renderer y main de Hub | Aprobados. Renderer con heap de 4 GiB. |
| ESLint dirigido de Architect | Aprobado en constructor, contrato y pruebas. |
| Lint incremental de Hub | Ocho archivos sin deuda nueva. |
| OpenSpec y arnés de Hub | Aprobados. |
| Sincronización de contratos | Copias idénticas en las tres plataformas. |

Las pruebas verifican privacidad por rol, compatibilidad, referencias, tiempos y huella de revisión. Utilizan dobles de base de datos, generador y fronteras remotas cuando corresponde. El piloto debe comprobar medios, permisos efectivos y emisión real.

## Compuertas pendientes

- verify:pr de Hub se detiene en runtime:stable al comprobar la versión del ejecutable Electron instalado. Pasaron adaptadores, arnés, cadena de suministro e integridad de CI.
- verify:pr de CourseForge se detiene en enlaces a Herk Edit Kit de reportes/2026-11-14-factibilidad-herk-edit-kit.md, presente antes de esta tarea. Pasaron adaptadores y arnés.
- Typecheck completo de Academy con 4 GiB detecta dependencias ausentes y referencias generadas de Next.js. La salida no reporta errores en los archivos modificados para esta preparación.
- La suite SQL studio-participation-coordination requiere @electric-sql/pglite, ausente en este checkout.

Las pruebas que fallaron al crear temporales o arrancar workers en Windows se repitieron fuera del sandbox con un solo worker. El límite automático de Node agotó memoria en los intentos iniciales de tipos de Hub y Academy.

## Revisión adversarial

Se verificaron la exclusión de notas por rol en servidor y UI, la proyección de clientes anteriores, límites y referencias. Se detectó el reemplazo de contenido con una misma revisión y se agregó una huella privada con prueba negativa. Se conservó el mensaje de error de identificadores duplicados usado por el dominio.

El estado sigue bajo permisos exclusivos de service_role. La API revalida acceso y proyecta por actor. El panel privado queda fuera de las escenas del programa. Compartir pantalla completa y grabar requiere comprobar la exposición del panel durante el piloto.

## Alcance pendiente

La primera entrega utiliza notas existentes. El guion de teleprompter completo, los documentos faltantes, nuevos archivos y la emisión de medios siguen en las entregas posteriores. Los vínculos de láminas a bloques requieren autoría explícita.

Publicar Academy compatible antes de Architect y Hub. Evitar servidores anteriores tras guardar JSON ampliado. Las siguientes tareas siguen abiertas y el cambio permanece sin archivar. La publicación y el piloto requieren operación posterior. Los cambios son locales y preservan el trabajo preexistente.
