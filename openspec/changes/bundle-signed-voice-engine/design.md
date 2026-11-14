# Diseño

## Distribución
Windows prepara Python privado en CI y firma los binarios extraídos antes de
invocarlos; firma también las extensiones agregadas por pip antes de validar
imports. Las firmas válidas de proveedores se conservan. Ejecutables propios
requieren editor exacto configurado y sello de tiempo. Vosk pequeño se descarga
durante build desde URL fija con SHA256 versionado y se valida por archivos reales.
Se distribuye bajo resources/models; modelo grande y TTS opcionales mantienen
su comportamiento explícito y quedan fuera de la preparación básica.

## Firma
SignTool usa SHA256 y RFC3161. Se admite Azure Artifact Signing con dlib fijado
por versión/hash y metadata de cuenta/perfil, o certificado por thumbprint en
CurrentUser/My (HSM/proveedor de clave compatible). La publicación Windows exige
editor/configuración; el smoke aislado sin firma requiere overrides explícitos
y nunca se utiliza para publicar. El hook de electron-builder firma exe/dll/pyd/node,
incluidos recursos y extensiones nativas; una compuerta afterSign verifica el
inventario real. NSIS y el instalador visual se firman antes de calcular sus hashes
y antes de subir artefactos. No se modifica el payload después de firmar.

## Reparación
Un ejecutable .NET firmado contiene ZIP con Python/dependencias, sidecars y modelo.
Main valida Authenticode/editor exacto antes de invocarlo sin shell. El extractor
usa destino de perfil versionado, staging y promoción; rechaza rutas absolutas,
traversal y enlaces/junctions en destino. No ejecuta Python ni paquetes descargados
antes de verificar el contenedor. La reparación no usa pip ni fuentes remotas.
El helper puede copiar archivos tras cerrar la app; no habilita captura. Sesión,
caller, grant y cancelación de captura siguen gobernados por el coordinador main.

## Límites
La reparación duplica una copia comprimida del motor en el instalador: costo de
tamaño aceptado para recuperar sin red ni reconstrucción. No se garantiza cierre
transaccional de descendientes ni disponibilidad de proveedores remotos. No se
emite firma real sin credenciales; las pruebas con fixtures no acreditan confianza
pública. Revertir código/build/docs juntos; no borrar datos ni certificados.
