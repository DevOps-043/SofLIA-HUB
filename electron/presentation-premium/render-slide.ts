import type { ResolvedTheme, SlideData } from './types';
import {
  renderContent,
  renderImageFocus,
  renderQuote,
  renderTitle,
  renderTwoColumn,
} from './render-basic';
import { renderClosing, renderComparison, renderSectionBreak } from './render-basic-extra';
import { renderDataTable, renderFlowchart, renderInfographic, renderStats } from './render-advanced-a';
import { renderIconGrid, renderProcess, renderTimeline } from './render-advanced-b';

export function renderSlide(
  slide: SlideData,
  theme: ResolvedTheme,
  idx: number,
  total: number,
  image: string | null,
): string {
  switch (slide.type) {
    case 'title': return renderTitle(slide, theme, idx, total, image);
    case 'content': return renderContent(slide, theme, idx, total, image);
    case 'two-column': return renderTwoColumn(slide, theme, idx, total);
    case 'image-focus': return renderImageFocus(slide, theme, idx, total, image);
    case 'quote': return renderQuote(slide, theme, idx, total);
    case 'section-break': return renderSectionBreak(slide, theme, idx, total, image);
    case 'comparison': return renderComparison(slide, theme, idx, total);
    case 'closing': return renderClosing(slide, theme, idx, total, image);
    case 'infographic': return renderInfographic(slide, theme, idx, total, image);
    case 'flowchart': return renderFlowchart(slide, theme, idx, total, image);
    case 'data-table': return renderDataTable(slide, theme, idx, total);
    case 'stats': return renderStats(slide, theme, idx, total, image);
    case 'timeline': return renderTimeline(slide, theme, idx, total);
    case 'process': return renderProcess(slide, theme, idx, total, image);
    case 'icon-grid': return renderIconGrid(slide, theme, idx, total);
    default: return renderContent(slide, theme, idx, total, image);
  }
}
