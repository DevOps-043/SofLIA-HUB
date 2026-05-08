export function formatSemanticSearchResults(rawResults: Array<{ filename: string; filepath: string; extract: string }>) {
  return rawResults.map((result) => ({
    file_name: result.filename,
    file_path: result.filepath,
    content_snippet: cleanSearchSnippet(result.extract),
  }));
}

function cleanSearchSnippet(extract: string): string {
  return extract
    .replace(/\[MATCH\]/g, '>>')
    .replace(/\[\/MATCH\]/g, '<<')
    .replace(/\s+/g, ' ')
    .trim() || '(Sin coincidencia directa extraible)';
}
