## Context

El usuario puede cambiar mientras `getUser` o la base responden. No se debe iniciar
un nuevo efecto con el usuario anterior ni presentar datos o éxito tras el cambio.

## Decisions

Suscribirse antes de la primera espera y liberar en finally. Eventos salvo la
sesión inicial invalidan la operación. Comprobar vigencia después de cada espera.
Si la escritura ya fue enviada, reportar resultado no confirmado sin afirmar que
se revirtió. La protección es local a esta ventana, no sustituye RLS ni JWT.
