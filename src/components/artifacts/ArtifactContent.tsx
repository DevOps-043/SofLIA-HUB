import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ArtifactPreview, ViewerSheet } from '../../shared/artifact-viewer';
import { MarkdownRenderer } from '../chat/MarkdownRenderer';
import { cleanTeamText } from '../../shared/background-team-display';
const PdfPreview = lazy(() => import('./PdfPreview').then(module => ({ default: module.PdfPreview })));

export function ArtifactContent({ preview, source }: { preview: ArtifactPreview; source: boolean }) {
  const content = preview.content;
  if (content.kind === 'pdf') return <Suspense fallback={<p role="status">Preparando PDF…</p>}><PdfPreview base64={content.base64} /></Suspense>;
  if ('base64' in content) return <BinaryPreview key={preview.name} content={content} name={preview.name} />;
  if (content.kind === 'spreadsheet') return <SheetPreview sheets={content.sheets} truncated={content.truncated} />;
  if (content.kind === 'slides') return <div className="artifact-slide-list">{content.slides.map((slide, index) => <article className="artifact-slide" key={index}><small>Diapositiva {index + 1}</small><h3>{slide.split('\n', 1)[0]}</h3><p>{slide.split('\n').slice(1).join('\n')}</p></article>)}<p className="artifact-preview-note">Vista de contenido. Abre PowerPoint para revisar la composición original.</p></div>;
  if (source || content.kind === 'text') return <pre className="artifact-source">{content.text}</pre>;
  if (content.kind === 'markdown') return <article className="artifact-paper"><MarkdownRenderer text={cleanTeamText(content.text)} />{content.truncated && <p role="status">Se muestra una parte del archivo.</p>}</article>;
  if ((content.kind !== 'html' && content.kind !== 'document') || !content.url) return <p role="alert" className="artifact-preview-note">No pude preparar la vista previa. Cierra el visor y vuelve a abrir el archivo.</p>;
  return <FramePreview key={content.url} content={content} />;
}
function FramePreview({ content }: { content: Extract<ArtifactPreview['content'], { kind: 'html' | 'document' }> }) {
  const [loading, setLoading] = useState(true);
  return <div className="artifact-frame-container">{loading && <p role="status" className="artifact-preview-note">Cargando vista previa…</p>}<iframe name="pulse-artifact-preview" title={content.kind === 'html' ? 'Vista previa de la aplicación' : 'Vista previa del documento'}
    sandbox={content.kind === 'html' ? 'allow-scripts' : ''} referrerPolicy="no-referrer"
    src={content.url} onLoad={() => setLoading(false)} />
    {content.truncated && <p role="status" className="artifact-preview-note">Se muestra una parte del archivo.</p>}</div>;
}
function BinaryPreview({ content, name }: { content: Extract<ArtifactPreview['content'], { kind: 'pdf' | 'image' }>; name: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const data = Uint8Array.from(atob(content.base64), character => character.charCodeAt(0));
    const objectUrl = URL.createObjectURL(new Blob([data], { type: content.mime }));
    if (image.current) image.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [content]);
  return <div className="artifact-image"><img ref={image} alt={name} /></div>;
}
function SheetPreview({ sheets, truncated }: { sheets: ViewerSheet[]; truncated: boolean }) {
  const [index, setIndex] = useState(0);
  const sheet = sheets[index] ?? sheets[0];
  if (!sheet) return <p className="artifact-preview-note">El libro no contiene hojas.</p>;
  const columns = Math.max(0, ...sheet.rows.map(row => row.length));
  return <div className="artifact-sheet-view">
    <div className="artifact-table-scroll"><table aria-label={'Hoja ' + sheet.name}><thead><tr><th scope="col">#</th>{Array.from({ length: columns }, (_, column) => <th scope="col" key={column}>{columnLabel(column)}</th>)}</tr></thead>
      <tbody>{sheet.rows.map((row, rowIndex) => <tr key={rowIndex}><th scope="row">{rowIndex + 1}</th>{row.map((cell, column) => <td key={column} title={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
    <nav className="artifact-sheet-tabs" aria-label="Hojas del libro">{sheets.map((item, number) => <button type="button" key={item.name} aria-pressed={number === index} onClick={() => setIndex(number)}>{item.name}</button>)}</nav>
    {truncated && <p role="status" className="artifact-preview-note">Vista limitada a las primeras hojas y filas. Descarga el libro completo para revisarlo.</p>}
  </div>;
}
function columnLabel(column: number): string {
  return column < 26 ? String.fromCharCode(65 + column) : String.fromCharCode(64 + Math.floor(column / 26)) + String.fromCharCode(65 + column % 26);
}
