## Purpose

Ofrecer selección controlada estable, operable por teclado y con relaciones ARIA válidas en el control UI compartido.

## ADDED Requirements

### Requirement: Identidad y opciones válidas
El selector MUST conservar identidad activa al reordenar opciones, y MUST anunciar sólo una opción existente/habilitada o ninguna. MUST impedir confirmar opciones ausentes/deshabilitadas y conservar valor controlado/API.

#### Scenario: Opciones cambian mientras se explora
- **WHEN** se reordena, retira o deshabilita la opción activa
- **THEN** la identidad conservada sigue activa si es válida; de otro modo deriva una habilitada y nunca confirma otra por un índice obsoleto

### Requirement: Teclado y foco
El control MUST permitir flechas/Home/End y prefijos sin escritura hasta confirmación. MUST ignorar atajos/composición, cerrar por blur/Tab y consumir Escape sólo con popup abierto. MUST conservar foco/portal modal y no reabrir al habilitar después de disabled.

#### Scenario: Escape dentro de diálogo
- **WHEN** se pulsa Escape con el popup abierto
- **THEN** sólo cierra el popup sin modificar valor ni cerrar el diálogo padre

#### Scenario: Prefijo y caracteres repetidos
- **WHEN** se escribe un prefijo o se repite un carácter dentro de la ventana
- **THEN** explora coincidencias habilitadas, conserva foco en trigger y sólo confirma al solicitarlo

### Requirement: Semántica y presentación verificables
La lista MUST tener nombre coherente con etiqueta externa y referencias válidas. MUST respetar movimiento reducido local y espacio disponible a zoom ampliado. La verificación MUST distinguir DOM/Chromium de auditoría AT/certificación global.

#### Scenario: Etiqueta externa y vista ampliada
- **WHEN** se abre un selector etiquetado mediante aria-labelledby a 200%
- **THEN** el listbox mantiene nombre y geometría utilizable sin salir de la capa modal

#### Scenario: Altura cambia y se explora el extremo de la lista
- **WHEN** el viewport reduce la altura del popup y el usuario pulsa End
- **THEN** la geometría cambia sin transición, la opción activa queda visible mediante scroll local y el desplazamiento posterior del usuario no fuerza volver a ella
