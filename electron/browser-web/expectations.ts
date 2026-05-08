import type { BrowserElementSnapshot, BrowserPageSnapshot } from './types';
import { normalizeText } from './normalizers';

export function expectedAppears(expected: string, snapshot: BrowserPageSnapshot): boolean {
  const needle = normalizeText(expected);
  if (!needle || needle.length < 3) {
    return false;
  }

  const haystack = normalizeText([
    snapshot.url,
    snapshot.title,
    snapshot.textExcerpt,
    snapshot.activeRef,
    snapshot.elements.map((element) => [
      element.ref,
      element.tag,
      element.role,
      element.label,
      element.text,
      element.placeholder,
      element.type,
      element.value,
      element.href,
      element.checked ? 'checked' : '',
    ].join(' ')).join(' '),
  ].join(' '));

  return haystack.includes(needle);
}

export function findElement(snapshot: BrowserPageSnapshot, ref?: string): BrowserElementSnapshot | undefined {
  if (!ref) {
    return undefined;
  }
  return snapshot.elements.find((element) => element.ref === ref);
}
