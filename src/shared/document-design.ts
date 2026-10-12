import { z } from 'zod';

export const DOCUMENT_FONTS = ['Calibri', 'Arial', 'Georgia'] as const;
export const documentDesignSchema = z.object({
  preset: z.enum(['editorial', 'formal', 'compact']).optional(),
  fontFamily: z.enum(DOCUMENT_FONTS).optional(),
  accentColor: z.string().regex(/^[\da-fA-F]{6}$/).optional(),
}).strict();
export type DocumentDesignOptions = z.infer<typeof documentDesignSchema>;

/** Valores declarativos compartidos por exportación y lectura; nunca CSS del modelo. */
export function resolveDocumentDesign(input?: DocumentDesignOptions) {
  const design = documentDesignSchema.parse(input ?? {});
  const preset = design.preset ?? 'editorial';
  return {
    font: design.fontFamily ?? (preset === 'formal' ? 'Georgia' : 'Calibri'),
    accent: design.accentColor?.toUpperCase() ?? '243746',
    bodySize: 22, titleSize: preset === 'compact' ? 44 : 52,
    paragraphAfter: preset === 'compact' ? 100 : 160,
    line: preset === 'compact' ? 264 : 288,
    headingSizes: [36, 28, 24] as const,
  };
}
export type DocumentDesign = ReturnType<typeof resolveDocumentDesign>;
export function documentHeaderText(accent: string): string {
  const components = [0, 2, 4].map(index => {
    const value = parseInt(accent.slice(index, index + 2), 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = components[0] * .2126 + components[1] * .7152 + components[2] * .0722;
  return luminance > .179 ? '000000' : 'FFFFFF';
}
export const DOCUMENT_PAGE = { width: 12240, height: 15840, margin: 1440, contentWidth: 9360 } as const;
export const DOCUMENT_COLORS = { text: '20252B', heading: '000000', muted: '5C6670', border: 'D9D9D9', stripe: 'F3F5F7', code: 'F3F5F7' } as const;
