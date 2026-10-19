## ADDED Requirements

### Requirement: Limpieza después de destruir la ventana
El navegador integrado SHALL completar su limpieza desde `closed` sin consultar
propiedades nativas de la ventana destruida. SHALL retirar los listeners del
renderer original y mantener `detachWindow` idempotente.

#### Scenario: Cierre con y sin pestañas
- **WHEN** Electron destruye la ventana y emite `closed`
- **THEN** la limpieza finaliza sin excepción, retira los listeners del renderer y libera las pestañas
- **AND** una segunda llamada a `detachWindow` no produce efectos adicionales

#### Scenario: Cierre tardío de una ventana reemplazada
- **WHEN** se acopla una nueva ventana y luego llega `closed` de la anterior
- **THEN** se conserva el acoplamiento y los listeners de la nueva ventana
