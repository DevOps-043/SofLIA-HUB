import type { LlmJsonTaskInput } from './types';

export function composeJsonTaskPrompt(task: LlmJsonTaskInput): string {
  return [
    'Eres el motor llm-task estructurado de SofLIA.',
    'Debes devolver EXCLUSIVAMENTE JSON valido.',
    'No incluyas markdown, comentarios ni texto extra.',
    'Cumple el schema dado con precision.',
    '',
    '### TAREA',
    task.prompt.trim(),
    '',
    '### INPUT JSON',
    JSON.stringify(task.input ?? {}, null, 2),
    '',
    '### SCHEMA JSON',
    JSON.stringify(task.schema, null, 2),
  ].join('\n');
}
