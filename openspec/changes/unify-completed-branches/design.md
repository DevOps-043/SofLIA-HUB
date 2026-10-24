## Decisiones

La integración parte de `codex/project-panel` (`3b4f898`), la implementación
terminada más reciente. Se trabaja en un worktree independiente; el checkout
principal permanece en `codex/reduce-technical-debt`.

La rama excluida apunta inicialmente a `e166d25`, también publicado como
`codex/studio-transitions`. Este ancestro compartido entra por las ramas terminadas;
no se fusiona la referencia de deuda ni se incorpora su trabajo sin commit.

`a7d705c` retiraba Project Hub el 22 de octubre. El chat de proyectos y la
implementación posterior `3b4f898`, del 24 de octubre, acreditan la reintroducción
del panel, gestión y seguridad. Aplicar el diff antiguo borraría esa entrega.
Se conserva su historial mediante un merge con estrategia `ours`, sin aplicar
su retirada sobre el árbol nuevo. Esta decisión no acredita desplegar la API
ni completar las capacidades portables pendientes.

Los conflictos en arquitectura del navegador e inventario de pruebas conservan
la documentación más reciente. El inventario se recalcula con su script.

## Verificación y reversión

Comprobar que cada rama inventariada, salvo la excluida, sea ancestro de la
integración; ejecutar tipos, pruebas dirigidas y gate de PR. Registrar fallos
preexistentes y límites sin ampliar baselines.

`main` local sólo avanza por fast-forward. Antes de avanzar se crea una referencia
de respaldo de su commit anterior `61cbadf`. La reversión posterior debe preservar
trabajo nuevo y usar los commits de merge como puntos de revisión. No se borran
ramas ni worktrees ajenos y no se hace push.
