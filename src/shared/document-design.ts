import { z } from 'zod';
import type { DocumentBranding } from './document-branding';

export const DOCUMENT_FONTS = ['Calibri', 'Arial', 'Georgia'] as const;
export const documentDesignSchema = z.object({
  preset: z.enum(['editorial', 'formal', 'compact', 'corporate']).optional(),
  fontFamily: z.enum(DOCUMENT_FONTS).optional(),
  accentColor: z.string().regex(/^[\da-fA-F]{6}$/).optional(),
  primaryColor: z.string().regex(/^[\da-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^[\da-fA-F]{6}$/).optional(),
  useOrganizationBranding: z.boolean().optional(),
}).strict();
export type DocumentDesignOptions = z.infer<typeof documentDesignSchema>;

/** Valores declarativos compartidos por exportación y lectura; nunca CSS del modelo. */
export function resolveDocumentDesign(input?: DocumentDesignOptions, identity?: DocumentBranding) {
  const design = documentDesignSchema.parse(input ?? {});
  const brand = design.useOrganizationBranding === false ? undefined : identity;
  const preset = design.preset ?? (brand ? 'corporate' : 'editorial');
  const corporate = preset === 'corporate';
  const primary = design.primaryColor?.toUpperCase() ?? brand?.primary ?? '0A2540';
  const secondary = design.secondaryColor?.toUpperCase() ?? brand?.secondary ?? '13263B';
  const accent = design.accentColor?.toUpperCase() ?? brand?.accent ?? (corporate ? '23AEA8' : '243746');
  return {
    preset, corporate, primary, secondary, accent,
    font: design.fontFamily ?? (preset === 'formal' ? 'Georgia' : brand?.fontFamily ?? (corporate ? 'Arial' : 'Calibri')),
    heading: corporate ? primary : '000000', body: corporate ? '1D2B36' : '20252B',
    tableFill: corporate ? primary : accent,
    stripe: corporate ? documentTint(accent, .95) : 'F3F5F7', callout: documentTint(accent, .91),
    organizationName: brand?.organizationName, logo: brand?.logo,
    page: corporate ? { ...DOCUMENT_PAGE, margin: 1080, contentWidth: 10080 } : DOCUMENT_PAGE,
    bodySize: 22, titleSize: preset === 'compact' ? 44 : corporate ? 56 : 52,
    paragraphAfter: preset === 'compact' ? 100 : 160,
    line: preset === 'compact' ? 264 : 288,
    headingSizes: [36, 28, 24] as const,
  };
}
export function documentTint(color: string, amount: number): string {
  return [0, 2, 4].map(index => Math.round(parseInt(color.slice(index, index + 2), 16) * (1 - amount) + 255 * amount).toString(16).padStart(2, '0')).join('').toUpperCase();
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
