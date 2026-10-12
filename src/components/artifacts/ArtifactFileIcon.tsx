import './artifact-file-icon.css';
import { artifactFormat } from './artifact-format';

const symbols: Record<string, string> = {
  word: 'm7 11 2 7 3-5 3 5 2-7',
  markdown: 'M7 17v-6l3 3 3-3v6m4-6v6m-2-2 2 2 2-2',
  pdf: 'm8 18 4-8 4 8m-6-3h4',
  sheet: 'M7 11h10v7H7Zm0 3h10m-6-3v7',
  slides: 'M7 11h10v6H7Zm5 6v3m-3 0h6',
  code: 'm9 11-3 3 3 3m6-6 3 3-3 3m-2-7-2 8',
  image: 'M7 18l3-4 3 3 2-2 3 3M9 10h.01',
  text: 'M7 11h10M7 14h10M7 17h7',
};
/** Iconos pequeños de trazo uniforme; el color y el símbolo distinguen el formato. */
export function ArtifactFileIcon({ extension, small = false }: { extension: string; small?: boolean }) {
  const format = artifactFormat(extension);
  return <span aria-hidden="true" className={`artifact-file-icon family-${format.family}${small ? ' small' : ''}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Zm0 0v5h5" /><path d={symbols[format.family] ?? symbols.text} /></svg>
  </span>;
}
