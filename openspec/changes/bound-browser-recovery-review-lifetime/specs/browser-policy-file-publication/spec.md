## Purpose

Permitir publicar ajustes locales ante bloqueos de reemplazo transitorios en
Windows sin sobrescribir cambios ajenos ni repetir bajo autoridad revocada.

## ADDED Requirements

### Requirement: Propiedad de temporales
Una creación exclusiva fallida MUST NOT eliminar un temporal preexistente que
el publicador no creó. Ante un fallo antes de completar recuperación, la
limpieza MUST conservar el error controlado original y declarar residuos
protegidos sin imprimir datos o rutas privadas.

#### Scenario: Temporal ocupado
- **WHEN** la creación exclusiva encuentra un archivo previo en la ruta preparada
- **THEN** la publicación falla y el archivo previo permanece intacto

#### Scenario: Destino de cuarentena ocupado
- **WHEN** la publicación exclusiva de una cuarentena de políticas o SQLite encuentra un destino ajeno
- **THEN** la recuperación falla conservando ese destino, el principal y el respaldo

#### Scenario: Limpieza de cuarentena propia denegada
- **WHEN** falla la publicación principal y también la limpieza de una cuarentena efectivamente creada
- **THEN** permanece el error original y se informa del residuo protegido mediante un aviso sin rutas privadas

### Requirement: Reemplazo acotado y condicionado
La publicación asíncrona de políticas MUST tolerar bloqueos rename EPERM/EBUSY
transitorios en Windows mediante un máximo de cinco intentos y esperas sumadas
de 300 ms. MUST revalidar actor, plazo aplicable y bytes esperados después de
esperar y antes de cada publicación. MUST NOT borrar el destino para forzarla.

#### Scenario: Archivo retenido brevemente
- **WHEN** un tenedor impide reemplazar el archivo y lo libera dentro del presupuesto
- **THEN** se publica el cambio válido sin exigir repetir toda la operación

#### Scenario: Destino cambiado durante la espera
- **WHEN** otro escritor cambia un archivo esperado antes del reintento
- **THEN** se rechaza sin sobrescribir ese cambio

#### Scenario: Contexto o revisión revocados durante la espera
- **WHEN** deja de ser válida la autorización o revisión antes del siguiente intento
- **THEN** no se inicia otra publicación

#### Scenario: Bloqueo persistente o error no elegible
- **WHEN** se agota el presupuesto o el error no corresponde al caso soportado
- **THEN** se devuelve fallo conservando el principal anterior y sin reintentos ilimitados
