const fs = require('fs');
const path = require('path');

// Carpetas o archivos que no queremos contar (ej: dependencias, builds, etc.)
const excludeDirs = ['node_modules', '.git', 'dist', 'dist-electron', 'release', '.claude'];
// Extensiones de archivos de código que sí queremos contar
const includeExts = ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.md', '.sql'];

let totalLines = 0;
let fileCount = 0;
const extCounts = {};

function countLines(dir) {
    let files;
    try {
        files = fs.readdirSync(dir);
    } catch (e) {
        return; // Ignoramos si no se puede leer el directorio
    }
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        let stat;
        try {
            stat = fs.statSync(fullPath);
        } catch (e) {
            continue;
        }
        
        if (stat.isDirectory()) {
            // Si es un directorio y no está excluido, entra recursivamente
            if (!excludeDirs.includes(file)) {
                countLines(fullPath);
            }
        } else {
            const ext = path.extname(file) || file; // Para archivos sin extensión como .env
            
            // Si la extensión está permitida
            if (includeExts.includes(ext) || file.startsWith('.env')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.split('\n').length;
                    totalLines += lines;
                    fileCount++;
                    
                    // Sumamos por extensión (opcional para dar más detalles)
                    extCounts[ext] = (extCounts[ext] || 0) + lines;
                } catch (e) {
                    // Ignorar archivos que no se puedan leer
                }
            }
        }
    }
}

console.log('Analizando repositorio en:', __dirname);
countLines(__dirname);

console.log(`\n================ RESULTADOS ================`);
console.log(`Total de archivos analizados: ${fileCount.toLocaleString()}`);
console.log(`Total de líneas escritas:     ${totalLines.toLocaleString()}`);
console.log(`============================================\n`);

console.log(`Detalle por extensión:`);
const sortedExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]);
for (const [ext, count] of sortedExts) {
    console.log(`  ${ext || 'Sin extensión'}: ${count.toLocaleString()} líneas`);
}
