## Context

El repositorio acumuló guías extensas por herramienta, SQL y documentación sin
taxonomía, archivos generados versionados y scripts que ya no correspondían al
código presente. Al mismo tiempo, los agentes runtime tienen permisos y riesgos muy
distintos de los agentes que desarrollan el producto. El diseño toma los cinco
componentes del modelo Arnés —instrucciones, herramientas, entorno, estado y
feedback— y los adapta a Electron, OpenSpec y las fronteras existentes de SofLIA.

## Goals / Non-Goals

**Goals:**

- Crear una fuente de contexto única, pequeña y enrutable.
- Hacer ejecutable el ciclo solicitud → especificación → tareas → cambio → evidencia.
- Impedir deuda nueva mediante compuertas progresivas compatibles con la línea base.
- Dejar preparada una gobernanza runtime denegada por defecto.

**Non-Goals:**

- Reescribir módulos funcionales o corregir toda la deuda histórica en este cambio.
- Implementar ahora un cargador runtime de skills de desarrollo.
- Ejecutar migraciones remotas, publicar una rama o desplegar.

## Decisions

### Fuente canónica y adaptadores delgados

`AGENTS.md`, `docs/`, `ai-specs/` y `openspec/` son normativos. Los archivos para
Codex, Claude y Antigravity apuntan a esas fuentes. Se descartan copias completas
porque divergen; también se descartan symlinks como única solución por su fragilidad
en Windows y OneDrive.

### OpenSpec para estado durable

OpenSpec conserva propuesta, requisitos, diseño y tareas versionados. Git conserva
el estado de código; los reportes del cambio conservan evidencia. Se descarta usar
solo conversaciones porque no son revisables ni reproducibles.

### Validación incremental

`lint:changed` bloquea deuda nueva mientras la deuda histórica permanece medida en
el reporte base. Las compuertas completas se endurecerán por módulos conforme se
normalicen. Se descarta desactivar reglas globalmente para obtener un verde artificial.

### Separación de ABI nativo

Las pruebas Node reconstruyen `better-sqlite3` para Node; el release lo reconstruye
otra vez para Electron antes de compilar. Esto evita confundir un error ABI local con
un fallo funcional y conserva el binario correcto para empaquetado.

### Gobernanza runtime documental primero

Este cambio define registro, requisitos y fronteras, pero no conecta permisos nuevos.
Una fase posterior implementará un registro tipado en main por dominio. Se descarta
cargar Markdown directamente porque instrucciones no son autorización ejecutable.

## Risks / Trade-offs

- Adaptadores generados pueden quedar desactualizados → `harness:validate` comprobará correspondencia.
- La reorganización puede romper enlaces o rutas runtime → verificación de enlaces, tipos, build y Context Pack.
- El lint incremental no elimina deuda histórica → línea base visible y plan de endurecimiento por módulo.
- Reconstruir módulos nativos aumenta tiempo de CI → se reserva para prueba integral y release.
- OpenSpec agrega disciplina y archivos → plantillas pequeñas y cambio piloto para probar utilidad.

## Migration Plan

1. Retirar artefactos locales y ordenar raíces canónicas.
2. Activar guías, skills y OpenSpec sin modificar permisos runtime.
3. Activar validadores y CI en modo de no-regresión.
4. Verificar tipos, build, pruebas, enlaces y especificaciones.
5. Adoptar el flujo en un módulo piloto y endurecer lint/cobertura gradualmente.

Rollback: revertir esta rama restaura estructura y scripts previos; no hay migraciones
remotas ni cambios de datos. Los movimientos usan historial Git para recuperar rutas.

## Open Questions

- Seleccionar el primer dominio funcional que use el registro runtime tipado.
- Definir umbrales de cobertura por módulo tras estabilizar las pruebas actuales.
