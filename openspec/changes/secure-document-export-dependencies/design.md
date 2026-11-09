## Context

Ver propuesta y context-pack. ExcelJS usa únicamente require('uuid').v4() en
CfRuleExtXform, para IDs de formato condicional. PptxGenJS 4.0.1 CJS/ESM sólo
importa JSZip; su mención sizeof está comentada y no usa image-size. Las APIs
de image-size 1/2 difieren para lectura de archivos. No es válido afirmar que
el Hub ejecuta los paths vulnerables por ver una entrada en npm audit.

## Goals / Non-Goals

**Goals:** retirar las copias afectadas y mantener la generación/relectura de
documentos, con pruebas explícitas de compatibilidad y retiro de overrides.

**Non-Goals:** sustituir bibliotecas, editar bundles de terceros, añadir shims
al producto, cambiar contratos o certificar visualmente una aplicación Office.

## Decisions

- Pin de padres a sus versiones instaladas: ExcelJS 4.4.0 y PptxGenJS 4.0.1.
Overrides únicamente bajo esos padres/versiones, sin cambiar las transitivas
de otros consumidores. uuid 11.1.1 mantiene CJS y v4 sin argumentos; no se elige
una mayor que retire ese contrato. image-size 2.0.4 corrige el parser; se prueba
la API buffer/fromFile y que el consumidor conserva su salida sin adaptación.
- El motivo y el retiro son explícitos: al actualizar el padre se reevalúan
manifest/lock/API y se retira el override cuando el cierre oficial esté
corregido. No debe extenderse el selector a otros padres/versiones por intuición.
- Reproducir UUID buffer corto y progresión ICNS con fixtures mínimos. QA
intercepta crecimiento de arrays tras 32 pushes y restaura en finally; un
timeout externo protege el proceso. No se ejecuta el caso en el Hub del usuario.
- Contratos compartidos en QA para tooling y Electron: UUID CJS/ESM, imágenes
válidas/malformadas, XLSX con CF extendido/IDs/relaciones y roundtrip, PPTX con
imagen/gráfica/OOXML y Word como regresión. Añadir prueba del exportador real
cuando permita verificar la ruta del Hub además de la biblioteca.
- Instalación ignore-scripts tras revisar el cierre, metadata y compatibilidad;
verificar copias físicas además de lock. No usar npm audit fix --force.
- skip_specs=true: cambio de implementación/dependencias, sin nuevos requisitos
de producto ni canales. Conservar las cuatro capas y las 24 unidades previas.

## Risks / Trade-offs

Mayor transitiva fuera del rango publicado → selector exacto y contratos reales,
con retirada al actualizar padre. Un archivo ZIP válido no prueba render visual
→ registrar limitación Office/multiplataforma. Caso malformado puede bloquear
→ guardas en proceso de QA y espera acotada con cierre observado. Auditoría
puede bajar sin exposición funcional demostrada → separar superficie instalada,
alcanzabilidad y contador de paquetes. No se acepta incompatibilidad para
reducir un contador.

## Migration Plan

Baseline/auditoría/fixtures protegidos; resolver y revisar dos overrides; instalar
sin hooks y comparar copias; contratos/nativo/documentos reales; docs/autorrevisión
y gate/build con fuentes congeladas. Recuperación selectiva a otro cierre
parcheado demostrado; conservar backups y no deshacer otras unidades. Revisión
independiente antes de archivar; publicación/despliegue fuera de este alcance.
