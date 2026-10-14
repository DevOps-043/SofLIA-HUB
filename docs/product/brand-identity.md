# Identidad de Soflia Hub

Estado: vigente. Actualizado: 2026-10-13.

El nombre público del producto es **Soflia Hub**. Se aplica al renderer, ventanas,
bandeja, mensajes y prompts runtime, documentos generados, instaladores,
accesos directos y metadatos de distribución.

El logo oficial es [Icono.png](../../public/assets/Icono.png), obtenido del PNG
transparente entregado por el usuario y coincidente con el ICO de SofLIA Learning.
Se recorta únicamente el margen transparente, sin modificar la figura ni sus
colores. El logo es vertical; las superficies usan `object-contain` para conservar
su proporción. El inicio del navegador limita también su altura.

[generate-app-icons.js](../../scripts/generate-app-icons.js) centra la marca sobre
un lienzo transparente de 1024 × 1024 y produce el icono Windows con tamaños
16, 24, 32, 48, 64, 128 y 256. El ICO original de Learning contiene un único frame
de 171 × 256; se genera una variante cuadrada compatible con los empaquetadores.
[generate-bitmaps.js](../../scripts/generate-bitmaps.js) reutiliza el mismo logo en
las imágenes del instalador y el fondo del DMG.

## Compatibilidad con instalaciones anteriores

La marca visual no renombra identificadores persistidos: `package.name`,
`appId`, repositorio de actualizaciones, encabezado `X-PulseHub-Session`, datos
autenticados del cifrado de la bóveda, claves de localStorage y nombres técnicos
del host de segundo plano permanecen compatibles.

[application-brand.ts](../../electron/main/application-brand.ts) fija `userData`
y `sessionData` antes de establecer el nombre público y crear sesiones. Las
versiones empaquetadas conservan el perfil `Pulse Hub`; desarrollo conserva su
perfil existente. Esto permite reutilizar preferencias, credenciales y cookies.
No se copian ni borran datos.

El shell de Windows acepta instalaciones con los nombres anterior y nuevo y
comprueba ambos procesos antes de iniciar. Reutiliza el destino anterior estándar
cuando contiene una instalación reconocida. Mantiene los recursos internos
`Pulse.*` y el mutex para impedir dos instaladores concurrentes.

Los próximos artefactos se llaman `Soflia-Hub-<plataforma>-<version>-...`.
El workflow y los smoke tests consumen esos nombres. Los releases ya publicados
conservan sus nombres históricos y el repositorio remoto actual.

Reversión: restaurar los textos y assets anteriores mediante Git. La identidad
de datos y el actualizador permanecen estables durante el cambio.
