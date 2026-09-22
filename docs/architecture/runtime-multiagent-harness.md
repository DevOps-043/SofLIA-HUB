# Arnés multiagente de reuniones

Estado: vigente. Actualizado: 2026-09-22.

<!-- evidence: electron/agent-runtime/service.ts -->
<!-- evidence: electron/agent-runtime/runtime.ts -->
<!-- evidence: electron/codex-runtime/provider.ts -->
<!-- evidence: src/components/meetings/MultiAgentPanel.tsx -->
<!-- evidence: src/shared/agent-runtime.ts -->

## Uso

En Meeting Ops, escribe título y transcripción en el formulario y usa **Análisis en equipo**.
El especialista de acuerdos y el de evidencia trabajan en paralelo; después,
el coordinador prepara una minuta. El panel muestra aportes, estados, tokens
observados y consultas. La fuente se entrega como datos a cada etapa mediante
el mismo dispatcher autorizado que atiende herramientas adicionales.

Gemini utiliza la clave existente de SofLIA y su modelo runtime. Para Codex,
abre Configurar Codex, selecciona su ejecutable nativo y guarda una clave API
OpenAI del contexto actual. La clave nunca se devuelve al renderer. La
configuración se conserva cifrada cuando el sistema permite hacerlo.
No se reutiliza la sesión personal de la aplicación Codex ni se copia auth.json.
La selección del ejecutable y el handshake se validan; la ejecución de modelos
requiere una cuenta y un modelo accesibles.

Revisa la minuta y marca la confirmación antes de **Crear borrador revisable**.
La autorización dura diez minutos y se liga al digest del resultado. El
pipeline existente procesa ese borrador y conserva sus revisiones/aprobaciones
antes de sincronizar acciones. Esta operación no equivale a enviar correos o
crear tareas aprobadas. Actualiza la lista de Meeting Ops para consultar el
borrador y su revisión.

## Arquitectura y alcance

[Orquestador](../../electron/agent-runtime/service.ts) → proveedor
[Gemini](../../electron/agent-runtime/gemini-provider.ts) o
[Codex](../../electron/codex-runtime/provider.ts) → catálogo cerrado de
[herramientas](../../electron/agent-runtime/tools.ts).

El equipo tiene un grafo fijo, sin delegación recursiva: acuerdos y evidencia,
seguidos de coordinador. El host controla la concurrencia. Esta implementación
usa threads independientes del app-server; no habilita las herramientas nativas
de spawn de Codex. Los roles son una estrategia de meeting-agent, no identidades
con permisos adicionales dentro de MCPManager.

Las herramientas permitidas son leer_transcripcion, buscar_evidencia y,
solo para el coordinador, leer_aportes. Ninguna realiza efectos externos. No
se cargan skills de desarrollo, Git, shell, plugins personales ni herramientas
arbitrarias del MCPManager. El dispatcher comparte validación y presupuesto
entre proveedores. No hay servidor MCP de SofLIA abierto en red.

Codex usa JSON por líneas a través de stdio, hogar por usuario/organización,
variables mínimas y credencial efímera dentro del proceso. Antes de enviar el
turno, se exige environments vacío, ausencia de instrucciones externas y un
inventario MCP vacío. Las herramientas dinámicas y selectedCapabilityRoots
requieren soporte experimental: una incompatibilidad termina la conexión.
Cada especialista usa su propio proceso; al cancelar se cierra ese proceso
aislado. No se conserva un turno de Codex para reanudarlo después.

La integración consume el binario instalado; no redistribuye código ni binarios
de Codex. La licencia raíz del repositorio investigado es Apache-2.0. Una futura
distribución debe revisar también NOTICE y licencias de componentes incluidos;
esta entrega no empaqueta bubblewrap ni otro componente de terceros.

## Identidad, permisos y efectos

La sesión SOFIA validada por main fija el propietario del arnés. Una organización
seleccionada requiere membresía activa en organization_users. El renderer no
puede suministrar userId, catálogo, RPC, rutas de trabajo ni políticas arbitrarias.

La creación del borrador utiliza el identificador de la sesión Lia, que puede
diferir del de SOFIA. Se comprueban ambas identidades entre etapas del pipeline.
Si cambia la sesión se detienen operaciones posteriores. Un efecto ya iniciado
puede haberse completado: se conserva estado incierto en vez de reintentarlo.

Los handlers verifican ventana principal, frame principal, payload y contexto.
Cambiar contexto, cerrar sesión o salir del panel cancela el análisis y retira
confirmaciones. La minuta no concede autoridad por contener instrucciones.

## Persistencia y recuperación

El [repositorio](../../electron/agent-runtime/repository.ts) guarda snapshots
cifrados con safeStorage, por hash de usuario/organización, bajo
userData/agent-runtime/runs. Valida el esquema al leer, escribe mediante reemplazo
atómico y conserva veinte ejecuciones por ámbito. Sin cifrado seguro, trabaja
en memoria y lo indica en el panel; no degrada a texto claro.

Al abrir un ámbito, ejecuciones que estaban activas o pendientes de revisión se
muestran interrumpidas, con sus aprobaciones retiradas. Recuperar crea una nueva
ejecución de lectura ligada a la anterior. Una publicación pendiente al reiniciar
se vuelve incierta y no se repite automáticamente.

Si aparece **Comprueba el resultado en Meeting Ops**, revisa la lista antes de
crear otra operación. No se promete entrega exactamente una vez entre sistemas;
el servicio Meeting Ops conserva además su deduplicación por fuente, propietario
y comprobación de organización antes de reutilizar una ejecución.

La retención local del arnés no elimina los borradores ya guardados en Meeting
Ops ni gestiona la retención del proveedor. No hay sincronización del historial
del arnés entre dispositivos.

## Límites y verificación

La fuente de parámetros es [AGENT_LIMITS](../../src/shared/agent-runtime.ts):
80000 caracteres de fuente, 24000 por salida, doce consultas por etapa, seis
llamadas por etapa Gemini, 3000 tokens de salida solicitados por llamada Gemini,
tres minutos por análisis y treinta segundos por solicitud RPC.
Codex se corta por duración, herramientas y uso observado; no se garantiza un
tope monetario ni un número exacto de iteraciones internas del motor.

Las citas de líneas facilitan revisión humana; no prueban por sí solas que la
interpretación del modelo sea correcta. La integración no acredita una mejora
de calidad o costo frente a un agente único sin evaluación con datos reales.

Ver [evidencia del cambio](../../openspec/changes/integrate-multiagent-harness/reports/verification.md).
El test codex-runtime-native es opt-in mediante SOFLIA_CODEX_TEST_EXECUTABLE y
comprueba el handshake sin inferencia. Las pruebas de proveedores usan procesos
simulados para comprobar fallos, herramientas prohibidas y cancelación.

## Retirada

Retirar el panel y initializeAgentRuntime desactiva esta capacidad. No requiere
migraciones. Los borradores creados permanecen en Meeting Ops y siguen sus
políticas de retención. Las rutas de datos locales y las credenciales guardadas
se gestionan aparte; no se borran implícitamente al quitar la interfaz.
