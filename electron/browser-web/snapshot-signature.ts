import {
  normalizeComparableUrl,
  normalizeText,
} from './normalizers';
import type { BrowserPageSnapshot } from './types';

export function buildBrowserSnapshotSignature(snapshot: BrowserPageSnapshot): string {
  const compactElements = snapshot.elements.slice(0, 12).map((element) => [
    element.ref,
    element.tag,
    element.role,
    element.label,
    element.text,
    element.placeholder,
    element.type,
    element.value,
    element.checked ? 'checked' : '',
    element.disabled ? 'disabled' : '',
  ].join('|'));

  return [
    normalizeComparableUrl(snapshot.url),
    normalizeText(snapshot.title),
    normalizeText(snapshot.textExcerpt).slice(0, 700),
    String(snapshot.scrollY),
    snapshot.activeRef,
    compactElements.join('||'),
  ].join('##');
}
