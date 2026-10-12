import type { StudioExamples } from '../../../src/components/learning-live/instructor/studio-types';

// Todos los nombres, mensajes, archivos y métricas pertenecen a la fixture.
export const studioExamples: StudioExamples = {
  scenes: [
    { id: 'opening', name: 'Apertura', kind: 'slide', title: 'De una idea\na un flujo de trabajo.', description: 'Las grandes soluciones empiezan\ncon una buena pregunta.' },
    { id: 'practice', name: 'Práctica', kind: 'slide', title: 'Tu primera\nautomatización.', description: 'Elige una tarea repetitiva.\nDiseña el primer paso con tu equipo.' },
    { id: 'break', name: 'Pausa', kind: 'slide', title: 'Un momento\npara conectar.', description: 'Revisa lo aprendido y comparte\nuna pregunta con tu grupo.' },
  ],
  participants: 24,
  messages: [
    { id: '1', authorId: 'instructor', author: 'Mariana', role: 'instructor', text: '¡Bienvenidos! Hoy vamos a convertir una idea en algo que podamos usar. 🚀', time: '12:00' },
    { id: '2', authorId: 'ana', author: 'Ana García', role: 'participant', text: '¡Lista para empezar! Me gustaría automatizar los reportes de mi equipo.', time: '12:01' },
    { id: '3', authorId: 'carlos', author: 'Carlos Mendoza', role: 'participant', text: '¿Cómo elegimos la primera tarea que vale la pena automatizar?', question: '¿Qué tarea automatizar primero?', time: '12:02' },
    { id: '4', authorId: 'lucia', author: 'Lucía Torres', role: 'participant', text: 'Tengo la misma duda que Carlos. Hay muchas tareas pequeñas en mi día.', question: '¿Qué tarea automatizar primero?', time: '12:02' },
    { id: '5', authorId: 'instructor', author: 'Mariana', role: 'instructor', text: 'Empiecen por algo repetitivo, con entradas claras y un resultado que puedan comprobar.', time: '12:03' },
    { id: '6', authorId: 'ana', author: 'Ana García', role: 'participant', text: 'Entonces el resumen semanal puede ser un buen primer caso 👏', time: '12:03' },
    { id: '7', authorId: 'soflia', author: 'SofLIA', role: 'soflia', text: 'Una pista: piensen en la tarea que repitieron al menos tres veces esta semana.', time: '12:04' },
    { id: '8', authorId: 'diego', author: 'Diego Ruiz', role: 'participant', text: '¿Podemos usar datos de ejemplo para practicar?', question: '¿Qué datos podemos usar?', time: '12:04' },
    { id: '9', authorId: 'ana', author: 'Ana García', role: 'participant', text: 'Ya tengo mi idea. ¿La compartimos en las salas?', time: '12:05' },
  ],
  resources: [
    { id: 'r1', name: 'Guía para tu primer flujo.pdf', detail: 'PDF · 2.4 MB · ejemplo', kind: 'reading' },
    { id: 'r2', name: 'Plantilla de práctica.docx', detail: 'DOCX · 148 KB · ejemplo', kind: 'file' },
    { id: 'r3', name: 'Lectura: preguntar mejor.pdf', detail: 'PDF · 820 KB · ejemplo', kind: 'reading' },
  ],
};
