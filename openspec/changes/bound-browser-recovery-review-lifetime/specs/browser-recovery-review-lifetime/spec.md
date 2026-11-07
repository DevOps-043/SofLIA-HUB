## Purpose

Mantener acotada y de un solo intento la revisión de recuperaciones locales,
aun cuando cambie el reloj civil o se atraviesen esperas antes de publicar.

## ADDED Requirements

### Requirement: Vigencia no ampliable por el reloj civil
Una revisión de recuperación MUST expirar como máximo a los cinco minutos de
tiempo de intervalo o de avance civil. Atrasar el reloj MUST NOT extenderla.
Una revisión vencida MUST NOT recuperar vigencia por nuevos cambios de reloj.

#### Scenario: Reloj atrasado
- **WHEN** transcurrieron cinco minutos de intervalo aunque el reloj civil retroceda
- **THEN** el commit se rechaza conservando los archivos públicos previos

#### Scenario: Reloj adelantado y luego corregido
- **WHEN** se observó el vencimiento por avance civil y el reloj vuelve atrás
- **THEN** esa misma revisión permanece vencida y requiere una revisión nueva

### Requirement: Consumo único y comprobación antes de nuevos efectos
Cada revisión MUST admitir un único intento y MUST revalidar actor, vigencia y
estado pertinente tras esperas/validación y antes de nuevas publicaciones.
Un segundo intento MUST rechazarse. Un syscall ya iniciado MUST NOT presentarse
como cancelado o revertido sólo porque el plazo venza mientras termina.

#### Scenario: Espera de cola o I/O
- **WHEN** la revisión vence mientras espera antes de iniciar publicación
- **THEN** no se inicia esa publicación ni se informa éxito

#### Scenario: Proyección lenta
- **WHEN** la validación/proyección consume el plazo antes de publicar
- **THEN** se rechaza el efecto con el principal previo conservado

### Requirement: Parcialidad recuperable y guardas preservadas
La corrección temporal MUST conservar cifrado, control de propietario, asociación
de archivos y confirmación HITL. Si sync ya dejó un marcador y vence antes de
terminar, MUST conservar bloqueo/diario para nueva revisión o rollback.

#### Scenario: Vencimiento después del marcador sync
- **WHEN** el marcador se publicó dentro del plazo y la revisión vence después
- **THEN** se rechazan nuevos efectos, el marcador queda y no se declara éxito
