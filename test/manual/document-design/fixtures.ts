import fs from 'node:fs/promises';
import path from 'node:path';
import { createProfessionalDocument } from '../../../electron/document-designer';
import { buildDocumentHtml } from '../../../electron/document-designer/html-document';

// Datos de demostración: ejercitan maquetación, no describen un cliente real.
const brief = {
  title: 'Dos propuestas de activación', subtitle: 'Rethink and Delight', author: 'Equipo de diseño',
  content: `## Una nueva mirada a lo cotidiano

Dos experiencias breves convierten una acción familiar en una sorpresa útil. Ambas propuestas se pueden montar en una estación de atención y terminan con una invitación a compartir lo descubierto.

### El giro amable

Durante una espera, la persona elige entre dos pequeñas mejoras para su experiencia. La opción seleccionada se entrega al momento, acompañada de una nota que explica qué fricción cotidiana se ha replanteado.

1. Identificar una espera concreta.
2. Ofrecer dos alternativas comprensibles.
3. Entregar la mejora y escuchar una reacción.

### Un objeto con doble vida

Un objeto familiar revela una función inesperada. La persona prueba esa segunda posibilidad y propone otra manera de usar algo que conoce.

| Propuesta | Duración | Material principal |
| --- | :---: | --- |
| El giro amable | 3 minutos | Tarjetas y una mejora útil |
| Un objeto con doble vida | 5 minutos | Un objeto cotidiano y una demostración |

**Próximo paso** Seleccionar una propuesta y probarla con un grupo pequeño antes de definir la producción.`,
};
const paragraphs = `El piloto busca comprobar que las personas entienden la propuesta y pueden participar sin una explicación extensa. El equipo recogerá observaciones sobre la claridad del mensaje, la facilidad de uso y la reacción al cierre. Los resultados servirán para ajustar la experiencia antes de una producción más amplia.

La evaluación distingue observaciones de interpretaciones. Cada registro debe describir una acción visible, indicar el momento de la experiencia y señalar si se necesita una prueba adicional. No se incorporarán conclusiones que no estén respaldadas por esos registros.`;
const rows = Array.from({ length: 32 }, (_, index) => `| ${index + 1} | ${index % 2 ? 'Un objeto con doble vida' : 'El giro amable'} | Revisar la claridad de la explicación y recoger una observación concreta de la interacción | ${index % 3 ? 'Pendiente' : ''} |`).join('\n');
const report = {
  title: 'Plan de evaluación de las activaciones', subtitle: 'Guía de trabajo para un piloto de experiencia', author: 'Equipo de diseño',
  content: `# Resumen del encargo\n\n${paragraphs}\n\n# Objetivos del piloto\n\n${paragraphs}\n\n# Preparación de la experiencia\n\n${paragraphs}\n\n## Antes de comenzar\n\n- Confirmar el espacio disponible.\n  - Verificar que la estación sea accesible.\n  - Probar la explicación con una persona nueva.\n- Preparar las tarjetas y el registro.\n\n# Registro de observaciones\n\nCada fila representa un punto de revisión. Los campos pendientes se conservan vacíos cuando corresponde.\n\n| ID | Experiencia | Revisión | Estado |\n| --- | --- | --- | --- |\n${rows}\n\n# Decisiones posteriores\n\n${paragraphs}`,
};
async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error('Indica una carpeta de salida para los ejemplos de QA.');
  await fs.mkdir(directory, { recursive: true });
  for (const [name, options] of Object.entries({ breve: brief, informe: report })) {
    await createProfessionalDocument({ ...options, outputPath: path.join(directory, name + '.docx'), type: 'word' });
    await fs.writeFile(path.join(directory, name + '.html'), buildDocumentHtml(options));
    await fs.writeFile(path.join(directory, name + '.json'), JSON.stringify(options));
  }
}
void main();
