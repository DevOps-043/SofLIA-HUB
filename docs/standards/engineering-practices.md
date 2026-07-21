# Estandar maestro de ingenieria

Estado: vigente. Actualizado: 2026-07-21.

<!-- evidence: AGENTS.md -->
<!-- evidence: package.json -->
<!-- evidence: electron/preload.ts -->
<!-- evidence: src/index.css -->
<!-- evidence: database/README.md -->

Este documento recupera las 17 areas del antiguo `docs/prompt_maestro.md` y las
adapta a la arquitectura real de SofLIA Hub. Es la fuente canonica extensa de
buenas practicas; `docs/prompt_maestro.md` es solamente un alias compatible.

## Como se aplica

El orden de precedencia es:

1. solicitud explicita del usuario;
2. limites de seguridad y autorizacion del entorno;
3. `AGENTS.md` y este estandar;
4. estandar especifico del area;
5. cambio OpenSpec activo y skill aplicable.

Una regla mas especifica puede endurecer este documento, pero no relajar
seguridad, HITL, trazabilidad o verificacion sin una decision explicita.

## 1. Prioridades de ingenieria

Cada solucion se evalua, en este orden:

1. correctitud funcional;
2. seguridad y privacidad;
3. legibilidad;
4. mantenibilidad;
5. modularidad;
6. confiabilidad y recuperacion;
7. rendimiento basado en evidencia;
8. testabilidad;
9. observabilidad;
10. documentacion trazable.

Un atajo solicitado debe incluir su costo, riesgo, alcance y plan de retiro. No
se declara una optimizacion, escalabilidad o seguridad que no tenga evidencia.

## 2. Reglas no negociables

- Trabajar en unidades pequenas con criterio de aceptacion verificable.
- No mezclar UI, orquestacion, reglas de negocio, persistencia y efectos nativos.
- No introducir archivos o funciones grandes con responsabilidades distintas.
- No duplicar logica; tampoco crear abstracciones sin dos usos o una frontera
  contractual clara.
- No modificar areas no relacionadas sin registrar el motivo.
- No esconder configuracion de negocio en numeros o strings magicos.
- No aceptar nombres ambiguos cuando el dominio ofrece uno preciso.
- No agregar dependencias sin justificar necesidad, licencia, mantenimiento y
  superficie de ataque.
- No conservar codigo muerto, comentarios que contradicen el runtime ni errores
  silenciados.
- No imprimir, leer, versionar ni copiar secretos o valores de `.env`.
- No inventar contratos, tablas, permisos, resultados, capacidades o motivos
  historicos.
- No ejecutar borrado, shell, envio, migracion, despliegue o mutacion remota sin
  la autorizacion y HITL que corresponda.
- No cerrar una tarea sin pruebas proporcionales, documentacion y evidencia.

## 3. Calidad del codigo

El codigo nuevo o modificado debe ofrecer:

- alta cohesion y bajo acoplamiento;
- entradas, salidas, errores y efectos secundarios explicitos;
- tipos precisos en fronteras publicas;
- funciones con una responsabilidad reconocible;
- flujo de datos lineal cuando no haya una razon para hacerlo indirecto;
- validacion temprana en limites no confiables;
- manejo consistente de errores, cancelacion y recursos;
- comentarios que expliquen decisiones, no sintaxis;
- compatibilidad hacia atras deliberada, no accidental.

Se aplican SOLID, DRY, KISS, separacion de responsabilidades, composicion y fail
fast cuando reducen riesgo real. Ningun principio justifica una jerarquia o
framework interno mas complejo que el problema.

## 4. Estructura y modularidad de SofLIA Hub

### Electron e IPC

Una capacidad que cruza procesos mantiene estas cuatro capas:

1. servicio de negocio o integracion en `electron/`;
2. handler `ipcMain.handle()` con sanitizacion y respuesta controlada;
3. canal allowlisted y API expuesta desde `electron/preload/`;
4. wrapper tipado del renderer bajo `src/services/`.

No se llama Node, filesystem, shell o credenciales desde componentes React. Un
canal nuevo debe estar declarado en los grupos del preload, tener contrato
tipado, validar payload y cubrir exito, rechazo y error parcial.

### Renderer

- Componentes presentan estado y delegan efectos a hooks o servicios.
- Contextos mantienen estado transversal estable; no reemplazan una capa de
  negocio completa.
- Cargas remotas muestran estados de espera, vacio, error y reintento.
- Listas y procesos largos deben permitir cancelacion o ignorar respuestas
  obsoletas al desmontar.
- Los tokens visuales provienen de `src/index.css`; no se inventan colores
  paralelos dentro de un componente.

### Main, sidecars y herramientas dinamicas

- Servicios con ciclo de vida exponen inicio, cierre y liberacion idempotentes.
- Servicios standalone cargan Electron dinamicamente con fallback comprobado.
- Sidecars Python usan contratos de entrada/salida y timeouts explicitos.
- `tools/dynamic/` es una superficie runtime confiable, no un destino para
  skills de desarrollo, Git o shell general.
- Fachadas temporales conservan contratos durante un refactor y deben registrar
  cuando pueden retirarse.

Un archivo extenso es una senal para revisar cohesion, no una infraccion por
numero de lineas. Se divide cuando hay responsabilidades, ciclos de cambio o
pruebas independientes, no para cumplir una cifra arbitraria.

## 5. Bases de datos y modelo de datos

SofLIA usa tres instancias Supabase y bases SQLite locales. Antes de cambiar
persistencia se identifica propietario y consumidor:

- SOFIA: identidad, organizaciones, equipos y membresias;
- Lia: conversacion, monitoreo, memoria y conexiones operativas;
- IRIS: proyectos, issues, CRM, workflows, aprobaciones y artefactos;
- SQLite local: memoria, conocimiento, pensamientos e indice semantico.

Reglas obligatorias:

- Usar la migracion y directorio de la instancia correcta.
- Definir PK, FK, nulabilidad, defaults, unicidad e indices por patron de acceso.
- Habilitar y probar RLS por actor, organizacion u ownership; RLS activo con una
  politica permisiva no constituye aislamiento.
- Proteger PII con minimizacion, retencion y acceso de minimo privilegio.
- Usar transacciones para invariantes que abarcan varias escrituras.
- Diseñar reintentos con claves de idempotencia y conflictos observables.
- Evitar N+1, `select *`, scans evitables y listados sin paginacion.
- Justificar indices con consultas reales y evitar sobreindexar escrituras.
- Mantener migraciones idempotentes cuando la herramienta y el motor lo permitan.
- Documentar compatibilidad, backfill, rollback y validacion posterior.
- No ejecutar SQL remoto ni una migracion destructiva sin autorizacion explicita.

El antiguo objetivo generico de 100000 usuarios simultaneos no se adopta como
promesa: este repositorio no contiene un SLO ni una prueba que lo sustente. Toda
meta de carga debe convertirse primero en RNF medible y escenario reproducible.

## 6. APIs, IPC e integraciones

Cada contrato define:

- esquema y limites de entrada;
- salida exitosa y errores esperados;
- autenticacion, autorizacion y ownership;
- timeout, cancelacion y politica de reintento;
- idempotencia cuando una repeticion pueda duplicar efectos;
- paginacion, filtros, orden y limites de payload cuando apliquen;
- observabilidad y redaccion de datos sensibles;
- degradacion cuando el proveedor externo no esta disponible.

Los handlers no deben filtrar stack traces ni objetos internos al renderer. Los
reintentos usan backoff y solo se aplican a operaciones seguras o idempotentes.
OAuth, WhatsApp, Google Workspace, Supabase y cualquier proveedor de IA se tratan
como dependencias no confiables y parcialmente disponibles.

## 7. Seguridad obligatoria

Aplicar secure by design, minimo privilegio, defensa en profundidad y deny by
default:

- sanitizar IPC, URLs, rutas, nombres de archivo, comandos y contenido remoto;
- prevenir command injection, path traversal, SSRF, XSS, CSRF y deserializacion
  insegura segun la frontera;
- mantener CSP, aislamiento de contexto y allowlist IPC;
- bloquear herramientas peligrosas en chats grupales;
- exigir HITL antes de acciones destructivas o externas;
- validar MIME, extension, tamano y destino de archivos;
- separar credenciales por entorno y proceso;
- no tratar variables `VITE_*` como secretos: se incorporan al bundle cliente;
- no registrar tokens, cuerpos sensibles, PII o screenshots sin politica;
- revisar RLS, roles y ownership en cada nuevo acceso a datos;
- limitar rate, concurrencia y volumen en superficies expuestas;
- revisar dependencias y mantener el alcance de permisos minimo.

Una vulnerabilidad encontrada se describe con activo, actor, precondicion,
impacto, evidencia, mitigacion y prueba negativa. No se oculta para terminar otra
tarea.

## 8. Rendimiento y escalabilidad

Optimizar despues de localizar la ruta caliente y medir su cuello de botella.
Para cada cambio relevante evaluar CPU, memoria, red, disco, base de datos,
proveedor externo y experiencia del renderer.

- Evitar polling nuevo cuando puede reutilizarse un scheduler existente.
- Todo polling tiene intervalo, cancelacion, exclusión de ejecuciones solapadas y
  politica ante errores.
- Operaciones intensivas no bloquean el hilo del renderer.
- Capturas, OCR, archivos y respuestas de IA tienen limites de tamano y memoria.
- Usar batching, cache o colas solo con invalidacion y backpressure definidos.
- Aplicar lazy loading a codigo o datos costosos cuando mejore el tiempo real.
- Mantener payloads y selecciones de columnas acotados.
- Registrar presupuestos de tiempo, tamano o concurrencia en configuracion y en
  `docs/architecture/runtime-parameters.md`.

No afirmar escalabilidad por intuicion. Si no hay benchmark, se registra como
riesgo o hipotesis y se propone la medicion.

## 9. QA y pruebas

Cada cambio considera:

- caso feliz;
- entrada vacia, grande, malformada y fuera de rango;
- permisos insuficientes y actor equivocado;
- proveedor no disponible, timeout y respuesta parcial;
- reintento, duplicado, cancelacion y concurrencia cuando apliquen;
- compatibilidad con contratos existentes;
- regresion de la causa raiz.

Seleccionar pruebas unitarias para logica pura, integracion para fronteras,
contrato para IPC/datos y E2E para flujos criticos. Mocks representan fallos y
latencia, no solo respuestas felices.

Secuencia minima:

```powershell
npm run typecheck
npm run lint:changed
npm run harness:validate
npm run docs:check
```

Antes de entrega se ejecuta `npm run verify:pr`. `npm run verify:release` solo
corresponde a un candidato de release autorizado. Nunca se declara una prueba no
ejecutada ni se confunde una deuda preexistente con una regresion nueva.

## 10. Observabilidad y operacion

- Usar logs estructurados en espanol con nivel coherente.
- Propagar `correlation_id` o `trace_id` en flujos distribuidos y workflows.
- Registrar inicio, resultado, duracion y error seguro de efectos importantes.
- No usar `console.log` como unica estrategia para una ruta critica.
- Exponer health checks o estados cuando un servicio de larga vida lo requiera.
- Distinguir errores recuperables, de configuracion y de datos.
- Evitar tormentas de logs y limitar datos de alta cardinalidad.
- Verificar cierre de timers, listeners, procesos, workers y conexiones.

Si soporte no puede reconstruir que ocurrio sin reproducir el fallo, falta
observabilidad.

## 11. Documentacion y explicabilidad

Una entrega material documenta:

- objetivo, alcance y no objetivos;
- diagnostico y evidencia;
- contratos y capas afectadas;
- decision y alternativas relevantes;
- riesgos, limites y parametros;
- pruebas ejecutadas y brechas;
- rollback y efectos externos.

Las afirmaciones enlazan archivos reales. Reglas, requisitos, historias,
decisiones y limites usan IDs estables cuando forman parte del catalogo. Un
motivo se etiqueta como confirmado, inferido o no documentado; no se inventa una
historia retrospectiva.

## 12. Cambios y regresiones

- Especificar antes de implementar cuando cambia comportamiento o contrato.
- Preservar trabajo ajeno y confirmar el estado Git.
- Mantener reducido el radio de impacto.
- Revisar consumidores, imports, handlers, allowlists, wrappers y datos.
- Preferir cambios reversibles y rollout controlado para riesgo alto.
- Registrar estados parciales y recuperacion ante interrupcion.
- No mezclar refactor amplio y funcionalidad salvo que el diseno lo exija.
- Actualizar OpenSpec, tareas y evidencia conforme avanza la implementacion.

Arreglar una cosa no justifica romper tres mas. Compatibilidad, rollback y
observabilidad forman parte de la solucion.

## 13. Estructura de entrega

La respuesta se adapta al tamano de la tarea, pero una entrega material cubre:

1. resultado y objetivo entendido;
2. diagnostico tecnico y causa o hipotesis;
3. implementacion y archivos afectados;
4. riesgos y validaciones reales;
5. limites o mejoras posteriores que aporten valor.

No es obligatorio repetir encabezados para una correccion trivial. Si una
seccion no aplica, se omite; nunca se rellena con generalidades.

## 14. Malas practicas que requieren accion

Corregir dentro del alcance o registrar explicitamente:

- duplicacion y acoplamiento que cambian juntos;
- funciones o componentes con responsabilidades incompatibles;
- validacion, autorizacion o sanitizacion incompleta;
- consultas sin limite, indices o ownership adecuados;
- errores silenciosos y reintentos no idempotentes;
- recursos sin cierre y listeners duplicados;
- credenciales en renderer, logs o archivos versionados;
- ausencia de pruebas en una ruta de riesgo;
- nombres y contratos ambiguos;
- documentacion que describe archivos inexistentes o capacidades planeadas como
  si estuvieran implementadas.

Una preferencia de estilo sin impacto no es un bloqueo. La prioridad es riesgo
funcional, de seguridad, datos u operacion.

## 15. Regla de legibilidad

El codigo y su documentacion deben permitir que:

- otro agente continue sin reconstruir decisiones;
- una persona junior siga el flujo y sus invariantes;
- una persona senior audite contratos y riesgos;
- QA derive escenarios verificables;
- operacion diagnostique y recupere el servicio.

La legibilidad se mide por claridad de dominio, fronteras y efectos, no por
cantidad de comentarios.

## 16. Contexto real del proyecto

- Producto: aplicacion de escritorio Electron para operaciones empresariales.
- Frontend: React y TypeScript bajo `src/`.
- Backend local: Electron main, preload, sidecars e integraciones bajo
  `electron/` y `python/`.
- Datos: SOFIA, Lia, IRIS y SQLite local; consultar `docs/data/` antes de asumir
  ownership.
- Agentes de desarrollo: Antigravity, Codex y Claude mediante adaptadores del
  arnes; Cursor y Gemini CLI estan retirados.
- IA del producto: los proveedores runtime se documentan por separado y no se
  confunden con la herramienta de desarrollo.
- Entornos: local, CI y release; produccion externa no se asume accesible.
- Idioma: UI, prompts, logs, comentarios y documentacion en espanol.

El contexto concreto de cada tarea se completa desde el cambio OpenSpec, codigo,
contratos y datos versionados. Si falta una decision que cambie materialmente la
solucion, se detiene y se solicita.

## 17. Definicion profesional de terminado

Una tarea esta terminada cuando:

- cumple criterios de aceptacion y escenarios de error;
- respeta seguridad, permisos, HITL y contratos;
- pasa pruebas focalizadas y la compuerta proporcional;
- no deja secretos, artefactos generados ni enlaces rotos;
- actualiza especificacion y documentacion;
- conserva evidencia reproducible y riesgo residual;
- informa efectos externos y rollback;
- el estado Git final es comprensible y recuperable.

El objetivo no es producir codigo: es entregar una solucion correcta, segura,
auditable, mantenible y operable.
