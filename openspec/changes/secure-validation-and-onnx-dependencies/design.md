## Context

Ver propuesta/context-pack. Zod raíz resuelve 4.4.3 en main/renderer y tooling;
Jimp conserva 3.25.76, cuyo contrato no es intercambiable. El parser visual usa
la API mínima InferenceSession.create, Tensor y run de ONNX Runtime 1.27.0.
Su instalador utiliza adm-zip 0.5.18 sólo para paquetes NuGet de binarios.

## Goals / Non-Goals

**Goals:** cierre corregido, instalación física coherente, regresiones de
validación acotada y compatibilidad nativa con datos locales controlados.

**Non-Goals:** nuevas capacidades del agente, modelos/CUDA, autorización IPC,
forzar mayores transitivas, despliegue o certificación de plataformas sin ejecución.

## Decisions

- Fijar versiones directas Zod 4.6.7 y ONNX Runtime 1.30.0. Usar el cierre admitido
por ONNX (adm-zip ^0.6.0 resuelto seguro), sin override incompatible de versión.
Revisar lock y hooks antes de instalación; ignore-scripts y sólo hook específico
revisado si faltan binarios CPU. No descargar CUDA ni modelos para QA.
- Conservar los schemas/DTO de negocio. Probar biblioteca real con fixtures
pequeños y contadores de validaciones, sin pruebas de OOM sobre el proceso Hub.
Mantener sin cambios Zod 3/Jimp: la versión mayor requiere migración propia.
- Modelo ONNX mínimo generado localmente conforme proto oficial, sin pesos ni
descarga externa. Inferencia Identity CPU para comprobar carga N-API, forma,
valores y error de forma/entrada. Añadir integración del parser visual con
salida controlada cuando permita demostrar preproceso/decode sin detector real.
- ZIP de QA propio con ruta NuGet y bytes pequeños; verificar API de extracción
del instalador y rechazo de metadatos dañados en proceso hijo acotado cuando
proceda. No simular que se ejecutó una instalación GPU o descarga NuGet real.
- Probar Node y Electron instalados con perfiles temporales y red bloqueada;
no exponer tooling o shell a agentes runtime. Mantener separación main/preload/renderer.
- skip_specs: true: mantenimiento de implementación con contratos funcionales
existentes; no inventar una capacidad para satisfacer el validador OpenSpec.

## Risks / Trade-offs

Nativo actualizado puede no cargar → inferencia real en Node/Electron antes del
gate y registrar plataforma exacta. Cierre amplio puede actualizar paquetes
ajenos → comparar entradas con baseline y restaurar sólo lo no requerido antes
de instalar. Parsing Zod puede variar errores/tipos → casos de schemas reales,
tipos y suite completa. Avisos transitivos permanecen → evidencia de rutas,
sin declarar todo el árbol seguro ni rebajar bibliotecas funcionales.

## Migration Plan

Capturar baseline y versiones; resolver lock sin hooks; revisar cierre; instalar
y verificar físicamente; pruebas reales y consumidores; docs/autorrevisión,
gate/build congelados y evidencia. Rollback selectivo a otra versión parcheada
con contrato demostrado, conservando backups; no reactivar biblioteca vulnerable
para producir un verde. Revisión independiente antes de archivar.
