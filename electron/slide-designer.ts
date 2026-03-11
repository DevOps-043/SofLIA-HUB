/**
 * slide-designer.ts — Premium PowerPoint generation engine.
 *
 * Architecture:
 *   1. Agent produces a JSON array of SlideData objects (typed layouts).
 *   2. For each slide that carries an imagePrompt we call Gemini
 *      image-generation to obtain a contextual visual.
 *   3. pptxgenjs renders every slide with the chosen theme & layout.
 *
 * The module is intentionally *stateless* — every public function receives
 * all the context it needs so it can be called from any agent loop.
 */

import PptxGenJS from 'pptxgenjs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface SlideData {
  type:
    | 'title'
    | 'content'
    | 'two-column'
    | 'image-focus'
    | 'quote'
    | 'section-break'
    | 'comparison'
    | 'closing';
  title: string;
  subtitle?: string;
  bullets?: string[];
  leftColumn?: { heading: string; items: string[] };
  rightColumn?: { heading: string; items: string[] };
  quote?: { text: string; author: string };
  imagePrompt?: string;
  notes?: string;
}

export type ThemeName =
  | 'corporate-dark'
  | 'modern-light'
  | 'gradient-vibrant'
  | 'minimal-elegant'
  | 'tech-neon'
  | string; // Agent can use any custom name or pass custom_theme

interface ThemeColors {
  bg: string;
  bgAlt: string;
  accent: string;
  accentAlt: string;
  text: string;
  textMuted: string;
  heading: string;
  scrim: string;          // semi-transparent overlay hex (without alpha — we apply alpha via shapes)
  scrimOpacity: number;   // 0-100
}

interface Theme {
  colors: ThemeColors;
  fontHeading: string;
  fontBody: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Definitions
// ─────────────────────────────────────────────────────────────────────────────
const THEMES: Record<ThemeName, Theme> = {
  'corporate-dark': {
    colors: {
      bg: '0F1117',
      bgAlt: '1A1D2B',
      accent: '22D3EE',
      accentAlt: '6366F1',
      text: 'EAEAEA',
      textMuted: '9CA3AF',
      heading: 'FFFFFF',
      scrim: '000000',
      scrimOpacity: 55,
    },
    fontHeading: 'Segoe UI',
    fontBody: 'Segoe UI',
  },
  'modern-light': {
    colors: {
      bg: 'FFFFFF',
      bgAlt: 'F3F4F6',
      accent: '4F46E5',
      accentAlt: '7C3AED',
      text: '374151',
      textMuted: '6B7280',
      heading: '111827',
      scrim: '000000',
      scrimOpacity: 45,
    },
    fontHeading: 'Segoe UI',
    fontBody: 'Segoe UI',
  },
  'gradient-vibrant': {
    colors: {
      bg: '0F0720',
      bgAlt: '1E1145',
      accent: 'F472B6',
      accentAlt: 'A78BFA',
      text: 'E2E8F0',
      textMuted: 'A5B4C8',
      heading: 'FFFFFF',
      scrim: '0F0720',
      scrimOpacity: 60,
    },
    fontHeading: 'Segoe UI',
    fontBody: 'Segoe UI',
  },
  'minimal-elegant': {
    colors: {
      bg: 'FAF9F6',
      bgAlt: 'F0EDEA',
      accent: 'B8860B',
      accentAlt: '8B7355',
      text: '3C3C3C',
      textMuted: '8A8A8A',
      heading: '1A1A1A',
      scrim: '1A1A1A',
      scrimOpacity: 50,
    },
    fontHeading: 'Georgia',
    fontBody: 'Segoe UI',
  },
  'tech-neon': {
    colors: {
      bg: '0A0A0A',
      bgAlt: '141414',
      accent: '00FF87',
      accentAlt: '00D4FF',
      text: 'D4D4D4',
      textMuted: '737373',
      heading: 'FFFFFF',
      scrim: '000000',
      scrimOpacity: 60,
    },
    fontHeading: 'Consolas',
    fontBody: 'Segoe UI',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Image Generation
// ─────────────────────────────────────────────────────────────────────────────
async function generateSlideImage(
  genAI: GoogleGenerativeAI,
  prompt: string,
): Promise<string | null> {
  try {
    const imgModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });

    const enhancedPrompt = [
      'Generate a high-quality, professional photograph or illustration for a presentation slide.',
      'Style: modern, clean, corporate-quality. No text overlays, no watermarks.',
      'The image should work as a background or accent visual.',
      `Subject: ${prompt}`,
      'Aspect ratio: 16:9 widescreen.',
      'Make it visually stunning and suitable for a professional business presentation.',
    ].join(' ');

    const result = await imgModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      } as any,
    });

    const candidate = result.response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts as any[]) {
        if (part.inlineData) {
          return part.inlineData.data; // raw base64
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('[slide-designer] Image generation failed for prompt:', prompt, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Add a gradient scrim shape (dark overlay) so text is readable on images */
function addScrim(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  color: string,
  opacity: number,
  position: 'full' | 'left' | 'bottom' = 'full',
) {
  const opts: Record<string, any> = {
    fill: { color, transparency: 100 - opacity },
  };

  if (position === 'full') {
    Object.assign(opts, { x: 0, y: 0, w: '100%', h: '100%' });
  } else if (position === 'left') {
    Object.assign(opts, { x: 0, y: 0, w: '60%', h: '100%' });
  } else {
    Object.assign(opts, { x: 0, y: '55%', w: '100%', h: '45%' });
  }

  slide.addShape(pptx.ShapeType.rect, opts);
}

/** Add a thin accent bar at a position */
function addAccentBar(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  color: string,
  position: 'top' | 'left' | 'bottom',
) {
  const map: Record<string, Record<string, any>> = {
    top: { x: 0, y: 0, w: '100%', h: 0.06 },
    left: { x: 0, y: 0, w: 0.06, h: '100%' },
    bottom: { x: 0, y: 7.44, w: '100%', h: 0.06 },
  };
  slide.addShape(pptx.ShapeType.rect, { ...map[position], fill: { color } });
}

/** Add slide number */
function addSlideNumber(
  slide: PptxGenJS.Slide,
  num: number,
  total: number,
  color: string,
) {
  slide.addText(`${num} / ${total}`, {
    x: 11.2, y: 7.05, w: 1.5, h: 0.35,
    fontSize: 9, color, align: 'right',
    fontFace: 'Segoe UI',
  });
}

/** Add SofLIA branding watermark */
function addBranding(slide: PptxGenJS.Slide, color: string) {
  slide.addText('SofLIA', {
    x: 0.4, y: 7.05, w: 1.5, h: 0.35,
    fontSize: 8, color, align: 'left',
    fontFace: 'Segoe UI', italic: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Renderers — one function per slide type
// ─────────────────────────────────────────────────────────────────────────────

function renderTitleSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  imageB64: string | null,
) {
  const { colors } = theme;

  if (imageB64) {
    slide.background = { data: `image/png;base64,${imageB64}` } as any;
    addScrim(slide, pptx, colors.scrim, colors.scrimOpacity + 15, 'full');
  } else {
    slide.background = { color: colors.bg };
    // Decorative gradient shape
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: colors.accentAlt, transparency: 92 },
    });
  }

  // Accent bar
  addAccentBar(slide, pptx, colors.accent, 'top');

  // Small decorative accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: 4.5, y: 2.8, w: 4.3, h: 0.05,
    fill: { color: colors.accent },
  });

  // Title
  slide.addText(data.title, {
    x: 1.0, y: 3.0, w: 11.3, h: 1.5,
    fontSize: 40, fontFace: theme.fontHeading,
    color: colors.heading, bold: true, align: 'center',
    lineSpacing: 48,
  });

  // Subtitle
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 2.0, y: 4.6, w: 9.3, h: 1.0,
      fontSize: 18, fontFace: theme.fontBody,
      color: colors.textMuted, align: 'center',
    });
  }

  // Decorative bottom accent
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.3, w: '100%', h: 0.2,
    fill: { color: colors.accent, transparency: 70 },
  });
}

function renderContentSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  imageB64: string | null,
) {
  const { colors } = theme;
  slide.background = { color: colors.bg };

  addAccentBar(slide, pptx, colors.accent, 'top');

  // Left accent stripe
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: '100%',
    fill: { color: colors.accent, transparency: 50 },
  });

  // Title
  slide.addText(data.title, {
    x: 0.7, y: 0.3, w: imageB64 ? 7.0 : 11.5, h: 0.8,
    fontSize: 26, fontFace: theme.fontHeading,
    color: colors.accent, bold: true,
  });

  // Underline under title
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.7, y: 1.1, w: 2.5, h: 0.04,
    fill: { color: colors.accent },
  });

  // Bullets
  if (data.bullets && data.bullets.length > 0) {
    const bulletRows = data.bullets.map(b => ({
      text: b.replace(/^[-•*]\s*/, ''),
      options: {
        fontSize: 15,
        fontFace: theme.fontBody,
        color: colors.text,
        bullet: { code: '2022', color: colors.accent },
        paraSpaceAfter: 10,
        lineSpacing: 22,
      },
    }));
    slide.addText(bulletRows as any, {
      x: 0.7, y: 1.4, w: imageB64 ? 6.5 : 11.5, h: 5.5,
      valign: 'top',
    });
  }

  // Image on right side
  if (imageB64) {
    // Subtle background shape behind image area
    slide.addShape(pptx.ShapeType.rect, {
      x: 7.8, y: 0.5, w: 5.0, h: 6.5,
      fill: { color: colors.bgAlt },
      rectRadius: 0.15,
    });
    slide.addImage({
      data: `image/png;base64,${imageB64}`,
      x: 8.0, y: 0.7, w: 4.6, h: 6.1,
      rounding: true,
    } as any);
  }
}

function renderTwoColumnSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  imageB64: string | null,
) {
  const { colors } = theme;
  slide.background = { color: colors.bg };
  addAccentBar(slide, pptx, colors.accent, 'top');

  // Title
  slide.addText(data.title, {
    x: 0.7, y: 0.3, w: 11.5, h: 0.8,
    fontSize: 26, fontFace: theme.fontHeading,
    color: colors.accent, bold: true,
  });

  // Divider line under title
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.7, y: 1.1, w: 11.9, h: 0.03,
    fill: { color: colors.accent, transparency: 60 },
  });

  // Vertical center divider
  slide.addShape(pptx.ShapeType.rect, {
    x: 6.4, y: 1.5, w: 0.03, h: 5.5,
    fill: { color: colors.accent, transparency: 50 },
  });

  // Left column
  const left = data.leftColumn || { heading: '', items: [] };
  if (left.heading) {
    slide.addText(left.heading, {
      x: 0.7, y: 1.3, w: 5.5, h: 0.5,
      fontSize: 17, fontFace: theme.fontHeading,
      color: colors.heading, bold: true,
    });
  }
  if (left.items.length > 0) {
    const leftBullets = left.items.map(b => ({
      text: b, options: {
        fontSize: 14, fontFace: theme.fontBody, color: colors.text,
        bullet: { code: '25CF', color: colors.accent },
        paraSpaceAfter: 8,
      },
    }));
    slide.addText(leftBullets as any, {
      x: 0.7, y: 1.9, w: 5.5, h: 5.0, valign: 'top',
    });
  }

  // Right column
  const right = data.rightColumn || { heading: '', items: [] };
  if (right.heading) {
    slide.addText(right.heading, {
      x: 6.8, y: 1.3, w: 5.5, h: 0.5,
      fontSize: 17, fontFace: theme.fontHeading,
      color: colors.heading, bold: true,
    });
  }
  if (right.items.length > 0) {
    const rightBullets = right.items.map(b => ({
      text: b, options: {
        fontSize: 14, fontFace: theme.fontBody, color: colors.text,
        bullet: { code: '25CF', color: colors.accentAlt },
        paraSpaceAfter: 8,
      },
    }));
    slide.addText(rightBullets as any, {
      x: 6.8, y: 1.9, w: 5.5, h: 5.0, valign: 'top',
    });
  }
}

function renderImageFocusSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  imageB64: string | null,
) {
  const { colors } = theme;

  if (imageB64) {
    slide.background = { data: `image/png;base64,${imageB64}` } as any;
    addScrim(slide, pptx, colors.scrim, colors.scrimOpacity, 'bottom');
  } else {
    slide.background = { color: colors.bgAlt };
  }

  // Title at bottom with scrim
  slide.addText(data.title, {
    x: 0.8, y: 5.5, w: 11.5, h: 0.8,
    fontSize: 28, fontFace: theme.fontHeading,
    color: colors.heading, bold: true,
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 0.8, y: 6.3, w: 11.5, h: 0.6,
      fontSize: 14, fontFace: theme.fontBody,
      color: colors.textMuted,
    });
  }

  addAccentBar(slide, pptx, colors.accent, 'bottom');
}

function renderQuoteSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  _imageB64: string | null,
) {
  const { colors } = theme;
  slide.background = { color: colors.bgAlt };
  addAccentBar(slide, pptx, colors.accent, 'top');

  // Large quote marks
  slide.addText('"', {
    x: 1.0, y: 1.0, w: 2.0, h: 2.0,
    fontSize: 120, fontFace: 'Georgia',
    color: colors.accent, bold: true,
    transparency: 30,
  });

  const quoteText = data.quote?.text || data.bullets?.[0] || data.title;
  const quoteAuthor = data.quote?.author || data.subtitle || '';

  // Quote text
  slide.addText(quoteText, {
    x: 1.5, y: 2.5, w: 10.0, h: 2.5,
    fontSize: 24, fontFace: 'Georgia',
    color: colors.text, italic: true, align: 'center',
    lineSpacing: 36,
  });

  // Author
  if (quoteAuthor) {
    slide.addShape(pptx.ShapeType.rect, {
      x: 5.5, y: 5.2, w: 2.3, h: 0.03,
      fill: { color: colors.accent },
    });
    slide.addText(`— ${quoteAuthor}`, {
      x: 3.0, y: 5.4, w: 7.3, h: 0.5,
      fontSize: 14, fontFace: theme.fontBody,
      color: colors.textMuted, align: 'center',
    });
  }
}

function renderSectionBreakSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  imageB64: string | null,
) {
  const { colors } = theme;

  if (imageB64) {
    slide.background = { data: `image/png;base64,${imageB64}` } as any;
    addScrim(slide, pptx, colors.scrim, colors.scrimOpacity + 10, 'full');
  } else {
    slide.background = { color: colors.accent };
  }

  // Large section title centered
  slide.addText(data.title, {
    x: 1.5, y: 2.5, w: 10.3, h: 2.0,
    fontSize: 44, fontFace: theme.fontHeading,
    color: imageB64 ? colors.heading : colors.bg,
    bold: true, align: 'center',
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 2.5, y: 4.5, w: 8.3, h: 1.0,
      fontSize: 18, fontFace: theme.fontBody,
      color: imageB64 ? colors.textMuted : colors.bg,
      align: 'center',
    });
  }
}

function renderComparisonSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  _imageB64: string | null,
) {
  const { colors } = theme;
  slide.background = { color: colors.bg };
  addAccentBar(slide, pptx, colors.accent, 'top');

  // Title
  slide.addText(data.title, {
    x: 0.7, y: 0.3, w: 11.5, h: 0.8,
    fontSize: 26, fontFace: theme.fontHeading,
    color: colors.accent, bold: true,
  });

  // VS badge in center
  slide.addShape(pptx.ShapeType.ellipse, {
    x: 5.85, y: 3.5, w: 1.0, h: 1.0,
    fill: { color: colors.accent },
  });
  slide.addText('VS', {
    x: 5.85, y: 3.5, w: 1.0, h: 1.0,
    fontSize: 16, fontFace: theme.fontHeading,
    color: colors.bg, bold: true, align: 'center', valign: 'middle',
  });

  // Left panel
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.4, w: 5.2, h: 5.5,
    fill: { color: colors.bgAlt },
    rectRadius: 0.15,
  });

  const left = data.leftColumn || { heading: '', items: [] };
  if (left.heading) {
    slide.addText(left.heading, {
      x: 0.7, y: 1.5, w: 4.8, h: 0.6,
      fontSize: 18, fontFace: theme.fontHeading,
      color: colors.accent, bold: true, align: 'center',
    });
  }
  if (left.items.length > 0) {
    const bullets = left.items.map(b => ({
      text: b, options: {
        fontSize: 13, fontFace: theme.fontBody, color: colors.text,
        bullet: { code: '2713', color: colors.accent }, paraSpaceAfter: 6,
      },
    }));
    slide.addText(bullets as any, {
      x: 0.8, y: 2.2, w: 4.7, h: 4.5, valign: 'top',
    });
  }

  // Right panel
  slide.addShape(pptx.ShapeType.rect, {
    x: 7.0, y: 1.4, w: 5.2, h: 5.5,
    fill: { color: colors.bgAlt },
    rectRadius: 0.15,
  });

  const right = data.rightColumn || { heading: '', items: [] };
  if (right.heading) {
    slide.addText(right.heading, {
      x: 7.2, y: 1.5, w: 4.8, h: 0.6,
      fontSize: 18, fontFace: theme.fontHeading,
      color: colors.accentAlt, bold: true, align: 'center',
    });
  }
  if (right.items.length > 0) {
    const bullets = right.items.map(b => ({
      text: b, options: {
        fontSize: 13, fontFace: theme.fontBody, color: colors.text,
        bullet: { code: '2713', color: colors.accentAlt }, paraSpaceAfter: 6,
      },
    }));
    slide.addText(bullets as any, {
      x: 7.3, y: 2.2, w: 4.7, h: 4.5, valign: 'top',
    });
  }
}

function renderClosingSlide(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  data: SlideData,
  theme: Theme,
  imageB64: string | null,
) {
  const { colors } = theme;

  if (imageB64) {
    slide.background = { data: `image/png;base64,${imageB64}` } as any;
    addScrim(slide, pptx, colors.scrim, colors.scrimOpacity + 20, 'full');
  } else {
    slide.background = { color: colors.bg };
    // Decorative shapes
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: colors.accentAlt, transparency: 90 },
    });
  }

  addAccentBar(slide, pptx, colors.accent, 'top');
  addAccentBar(slide, pptx, colors.accent, 'bottom');

  // Thank you or closing title
  slide.addText(data.title || '¡Gracias!', {
    x: 1.5, y: 2.5, w: 10.3, h: 1.5,
    fontSize: 44, fontFace: theme.fontHeading,
    color: colors.heading, bold: true, align: 'center',
  });

  if (data.subtitle) {
    slide.addText(data.subtitle, {
      x: 2.5, y: 4.2, w: 8.3, h: 1.0,
      fontSize: 16, fontFace: theme.fontBody,
      color: colors.textMuted, align: 'center',
    });
  }

  // Decorative accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.0, y: 5.5, w: 3.3, h: 0.04,
    fill: { color: colors.accent },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: Parse raw markdown into SlideData[]
// ─────────────────────────────────────────────────────────────────────────────
export function parseMarkdownToSlides(content: string, title: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');
  let currentTitle = '';
  let currentBullets: string[] = [];
  let isFirst = true;

  const flush = () => {
    if (!currentTitle && currentBullets.length === 0) return;
    if (isFirst) {
      slides.push({
        type: 'title',
        title: currentTitle || title,
        subtitle: currentBullets.length > 0 ? currentBullets.join(' • ') : undefined,
        imagePrompt: `Professional abstract visual representing: ${currentTitle || title}`,
      });
      isFirst = false;
    } else {
      // Alternate slide types for variety
      const typeIdx = slides.length % 4;
      const types: SlideData['type'][] = ['content', 'content', 'image-focus', 'content'];
      slides.push({
        type: types[typeIdx],
        title: currentTitle,
        bullets: currentBullets.length > 0 ? currentBullets : undefined,
        imagePrompt: `Professional visual about: ${currentTitle}`,
      });
    }
    currentTitle = '';
    currentBullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flush();
      currentTitle = trimmed.replace(/^#{1,3}\s*/, '');
    } else if (trimmed === '') {
      // skip
    } else {
      currentBullets.push(trimmed.replace(/^[-•*]\s*/, ''));
    }
  }
  flush();

  // Add closing slide
  if (slides.length > 0) {
    slides.push({
      type: 'closing',
      title: '¡Gracias!',
      subtitle: 'Presentación generada por SofLIA',
      imagePrompt: 'Professional thank you slide background, abstract gradient',
    });
  }

  return slides;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePresentationOptions {
  slides: SlideData[];
  title: string;
  outputPath: string;
  theme?: ThemeName;
  /** Agent-generated custom theme — overrides theme name if provided */
  customTheme?: {
    colors?: Partial<ThemeColors>;
    fontHeading?: string;
    fontBody?: string;
  };
  includeImages?: boolean;
  genAI?: GoogleGenerativeAI;
}

/**
 * Build a premium PPTX file from structured slide data.
 * Returns the absolute path to the created file.
 */
export async function createPremiumPresentation(
  options: CreatePresentationOptions,
): Promise<string> {
  const {
    slides,
    title,
    outputPath,
    theme: themeName = 'corporate-dark',
    customTheme,
    includeImages = true,
    genAI,
  } = options;

  // Build theme: start with a base, then merge any custom overrides from the agent
  const baseTheme = THEMES[themeName as keyof typeof THEMES] || THEMES['corporate-dark'];
  const theme: Theme = customTheme
    ? {
        colors: { ...baseTheme.colors, ...(customTheme.colors || {}) },
        fontHeading: customTheme.fontHeading || baseTheme.fontHeading,
        fontBody: customTheme.fontBody || baseTheme.fontBody,
      }
    : baseTheme;
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pptx.author = 'SofLIA Hub';
  pptx.title = title;

  const totalSlides = slides.length;

  // ── Generate images in parallel (batch of 3 to avoid rate limits) ──
  const imageCache = new Map<number, string | null>();
  if (includeImages && genAI) {
    console.log(`[slide-designer] Generating images for ${slides.length} slides...`);

    const BATCH_SIZE = 3;
    for (let i = 0; i < slides.length; i += BATCH_SIZE) {
      const batch = slides.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((s, idx) => {
          if (s.imagePrompt) {
            return generateSlideImage(genAI, s.imagePrompt);
          }
          return Promise.resolve(null);
        }),
      );
      results.forEach((r, idx) => {
        imageCache.set(i + idx, r.status === 'fulfilled' ? r.value : null);
      });
    }

    const successCount = Array.from(imageCache.values()).filter(v => v !== null).length;
    console.log(`[slide-designer] Generated ${successCount}/${slides.length} images successfully.`);
  }

  // ── Render each slide ──
  for (let i = 0; i < slides.length; i++) {
    const data = slides[i];
    const slide = pptx.addSlide();
    const imageB64 = imageCache.get(i) || null;

    // Add speaker notes if present
    if (data.notes) {
      slide.addNotes(data.notes);
    }

    // Dispatch to layout renderer
    switch (data.type) {
      case 'title':
        renderTitleSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'content':
        renderContentSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'two-column':
        renderTwoColumnSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'image-focus':
        renderImageFocusSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'quote':
        renderQuoteSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'section-break':
        renderSectionBreakSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'comparison':
        renderComparisonSlide(slide, pptx, data, theme, imageB64);
        break;
      case 'closing':
        renderClosingSlide(slide, pptx, data, theme, imageB64);
        break;
      default:
        renderContentSlide(slide, pptx, data, theme, imageB64);
    }

    // Common elements
    addSlideNumber(slide, i + 1, totalSlides, theme.colors.textMuted);
    if (data.type !== 'title' && data.type !== 'closing') {
      addBranding(slide, theme.colors.textMuted);
    }
  }

  await pptx.writeFile({ fileName: outputPath });
  console.log(`[slide-designer] Presentation saved: ${outputPath} (${slides.length} slides)`);
  return outputPath;
}
