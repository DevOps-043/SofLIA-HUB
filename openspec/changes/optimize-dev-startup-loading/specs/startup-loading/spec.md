## ADDED Requirements

### Requirement: Carga completa concurrente
El bootstrap SHALL solicitar concurrentemente los módulos de servicios y esperar el conjunto antes de construir servicios y registrar sus canales.

#### Scenario: Variables consultadas durante import
- **WHEN** empieza a cargar los módulos dinámicos
- **THEN** la configuración del entorno ya se ejecutó y no depende del orden entre módulos

#### Scenario: Import lento
- **WHEN** un módulo sigue pendiente
- **THEN** los demás imports ya han comenzado y el loader todavía no publica módulos parciales

#### Scenario: Import fallido
- **WHEN** falla un import
- **THEN** la carga rechaza el error y no continúa la construcción de servicios

### Requirement: Diagnóstico del arranque
El sistema SHALL registrar entrada main, carga, entorno y construcción con milisegundos desde el origen del proceso, sin secretos.

#### Scenario: Evaluación estática costosa
- **WHEN** main termina de evaluar sus imports
- **THEN** el primer hito incluye ese tiempo y los hitos siguientes permiten distinguir las fases

### Requirement: Trabajo accesorio del build
El modo desarrollo SHALL omitir calcular tamaños gzip de main/preload y conservar funciones y recarga de fuentes.

#### Scenario: Build de producción
- **WHEN** se ejecuta vite build
- **THEN** el cálculo de tamaños comprimidos sigue habilitado

### Requirement: Reinicios de desarrollo sin duplicación
El sistema SHALL reiniciar Electron sólo ante cambios de código o assets main emitidos, serializar esos arranques y conservar la recarga de preload.

#### Scenario: Rebuild idéntico durante arranque
- **WHEN** el watcher vuelve a emitir el mismo contenido
- **THEN** no se interrumpe ni se repite el arranque ya solicitado

#### Scenario: Cambios reales
- **WHEN** cambia código o un asset emitido
- **THEN** se solicita otro arranque después del anterior sin solaparse

#### Scenario: Fallo de arranque
- **WHEN** falla iniciar Electron
- **THEN** el fallo se entrega al caller y un intento posterior con el mismo contenido sigue permitido

#### Scenario: Cambio del preload
- **WHEN** cambia sólo el preload con main ya iniciado
- **THEN** se recarga el renderer sin reiniciar el proceso main idéntico

### Requirement: Reutilización del SDK de WhatsApp en desarrollo
El build de main durante desarrollo SHALL resolver Baileys desde la instalación local. El runtime SHALL importar el paquete de forma asíncrona únicamente cuando la función correspondiente lo necesita.

#### Scenario: Compilación de desarrollo
- **WHEN** Vite compila main en modo serve
- **THEN** el bundle conserva el import dinámico de Baileys y omite compilar el SDK y su grafo

#### Scenario: Conexión cancelada durante la carga
- **WHEN** se revoca un intento mientras se resuelve Baileys
- **THEN** ese intento no genera un socket al concluir el import

#### Scenario: Compilación de producción
- **WHEN** Vite compila main en modo build
- **THEN** se mantiene el empaquetado de Baileys en el runtime diferido
