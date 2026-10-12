import { z } from 'zod';

const text = z.string().max(2500);
const column = z.object({ heading: text, items: z.array(text).max(20) }).strict();
export const legacySlidesSchema = z.array(z.object({ title: text.min(1), type: z.string().optional(), body: text.optional(), subtitle: text.optional(), bullets: z.array(text).max(20).optional(), notes: z.string().max(10000).optional(),
  leftColumn: column.optional(), rightColumn: column.optional(), quote: z.object({ text, author: text }).strict().optional(),
  stats: z.array(z.object({ value: text, label: text, trend: text.optional() }).strict()).max(12).optional(),
  items: z.array(z.object({ icon: text.optional(), label: text, description: text.optional(), color: text.optional() }).strict()).max(20).optional(),
  steps: z.array(z.object({ label: text, description: text.optional() }).strict()).max(20).optional(),
  tableData: z.object({ headers: z.array(text).min(1).max(8), rows: z.array(z.array(text).max(8)).max(40) }).strict().optional(),
  imagePrompt: text.optional(), diagramPrompt: text.optional(),
}).strict()).min(1).max(30);

export function legacySlideText(slide: z.infer<typeof legacySlidesSchema>[number]): string {
  return [slide.subtitle, slide.body, ...(slide.bullets ?? []),
    ...[slide.leftColumn, slide.rightColumn].flatMap(c => c ? [c.heading, ...c.items] : []),
    ...(slide.quote ? [`“${slide.quote.text}”`, slide.quote.author] : []),
    ...(slide.stats ?? []).map(s => `${s.value} — ${s.label}${s.trend ? ` (${s.trend})` : ''}`),
    ...(slide.items ?? []).map(s => [s.label, s.description].filter(Boolean).join(': ')),
    ...(slide.steps ?? []).map((s, i) => `${i + 1}. ${s.label}${s.description ? `: ${s.description}` : ''}`),
    ...(slide.tableData ? [slide.tableData.headers.join(' | '), ...slide.tableData.rows.map(r => r.join(' | '))] : []),
  ].filter(Boolean).join('\n');
}
