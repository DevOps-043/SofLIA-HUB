import {
  MAX_TEXT_EXCERPT,
  MAX_VISIBLE_ELEMENTS,
} from './constants';
import type { BrowserElementSnapshot } from './types';

type BrowserDomSnapshot = {
  elements: BrowserElementSnapshot[];
  textExcerpt: string;
  scrollY: number;
  activeRef: string;
};

export async function collectBrowserDomSnapshot(page: any): Promise<BrowserDomSnapshot> {
  return page.evaluate((input: { maxElements: number; maxTextExcerpt: number }) => {
    const { maxElements, maxTextExcerpt } = input;
    const previous = document.querySelectorAll('[data-soflia-ref]');
    previous.forEach((node) => node.removeAttribute('data-soflia-ref'));

    const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
    const isVisible = (el: Element) => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 6 || rect.height < 6) return false;
      if (rect.bottom < 0 || rect.right < 0) return false;
      if (rect.top > window.innerHeight || rect.left > window.innerWidth) return false;
      return true;
    };
    const getLabel = (el: Element) => {
      if (!(el instanceof HTMLElement)) return '';
      const aria = el.getAttribute('aria-label') || '';
      if (aria) return clean(aria).slice(0, 90);
      const labelledBy = el.getAttribute('aria-labelledby');
      if (!labelledBy) return '';
      const labelText = labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ');
      return labelText ? clean(labelText).slice(0, 90) : '';
    };
    const getValue = (el: Element) => {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return clean(el.value || '').slice(0, 120);
      if (el instanceof HTMLSelectElement) return clean(el.selectedOptions[0]?.textContent || el.value || '').slice(0, 120);
      if (el instanceof HTMLElement && el.isContentEditable) return clean(el.textContent || '').slice(0, 120);
      return '';
    };

    const seen = new Set<Element>();
    const elements: BrowserElementSnapshot[] = [];
    const selector = ['a', 'button', 'input', 'textarea', 'select', '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="combobox"]', '[contenteditable="true"]', '[data-testid]'].join(',');

    let index = 0;
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (seen.has(el) || !isVisible(el)) continue;
      seen.add(el);
      index++;
      const ref = `ref-${index}`;
      el.setAttribute('data-soflia-ref', ref);
      elements.push({
        ref,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || '',
        text: clean(el.textContent || '').slice(0, 90),
        label: getLabel(el),
        placeholder: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? (el.placeholder || '').slice(0, 90) : '',
        type: el instanceof HTMLInputElement ? (el.type || '').slice(0, 60) : '',
        href: el instanceof HTMLAnchorElement ? (el.href || '').slice(0, 180) : '',
        value: getValue(el),
        disabled: el instanceof HTMLElement && (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true'),
        checked: el instanceof HTMLInputElement ? !!el.checked : false,
      });
      if (elements.length >= maxElements) break;
    }

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return {
      elements,
      textExcerpt: clean(document.body?.innerText || '').slice(0, maxTextExcerpt),
      scrollY: Math.round(window.scrollY || 0),
      activeRef: activeElement?.getAttribute('data-soflia-ref') || '',
    };
  }, { maxElements: MAX_VISIBLE_ELEMENTS, maxTextExcerpt: MAX_TEXT_EXCERPT });
}
