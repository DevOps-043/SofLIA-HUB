type SafeReleaseNotesProps = {
  notes: string;
  className?: string;
};

const MAX_RELEASE_NOTES_CHARS = 8000;

function normalizeHtmlBreaks(value: string): string {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li(?:\s[^>]*)?>/gi, '- ');
}

export function toSafeReleaseNotesText(notes: string): string {
  const boundedNotes = String(notes || '').slice(0, MAX_RELEASE_NOTES_CHARS);
  const htmlWithBreaks = normalizeHtmlBreaks(boundedNotes);

  if (typeof document !== 'undefined') {
    const template = document.createElement('template');
    template.innerHTML = htmlWithBreaks;
    return (template.content.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  return htmlWithBreaks
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function SafeReleaseNotes({ notes, className = '' }: SafeReleaseNotesProps) {
  const safeText = toSafeReleaseNotesText(notes);
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {safeText}
    </div>
  );
}
