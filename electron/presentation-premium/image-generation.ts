import type { GoogleGenerativeAI } from '@google/generative-ai';

function buildImagePrompt(prompt: string, isDiagram: boolean): string {
  if (isDiagram) {
    return `Generate a clean, flat-design infographic diagram illustration. Style: minimal, vector-art, modern flat design with clean shapes and simple icons. NO TEXT anywhere in the image. Use vibrant accent colors on a dark background. Subject: ${prompt}. Aspect ratio: 16:9 widescreen. Make it visually clean and suitable for a professional presentation.`;
  }

  return `Generate a high-quality, professional photograph or illustration for a presentation slide. Style: modern, clean, corporate-quality. No text overlays, no watermarks. Subject: ${prompt}. Aspect ratio: 16:9 widescreen. Make it visually stunning.`;
}

export async function generateSlideImage(
  genAI: GoogleGenerativeAI,
  prompt: string,
  isDiagram = false,
): Promise<string | null> {
  try {
    const imgModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image' });
    const result = await imgModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: buildImagePrompt(prompt, isDiagram) }] }],
      generationConfig: { responseModalities: ['IMAGE'] } as any,
    });

    const parts = result.response.candidates?.[0]?.content?.parts as any[] | undefined;
    for (const part of parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (err) {
    console.warn('[presentation-premium] Image gen failed:', prompt, err);
    return null;
  }
}
