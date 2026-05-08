import type { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateSlideImage(genAI: GoogleGenerativeAI, prompt: string): Promise<string | null> {
  try {
    const imgModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image' });
    const enhancedPrompt = [
      'Generate a high-quality professional presentation image.',
      'Style: modern, clean, corporate-quality. No text overlays, no watermarks.',
      `Subject: ${prompt}. Aspect ratio: 16:9 widescreen.`,
    ].join(' ');

    const result = await imgModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: enhancedPrompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] } as any,
    });

    const parts = result.response.candidates?.[0]?.content?.parts as any[] | undefined;
    const imagePart = parts?.find(part => part.inlineData);
    return imagePart
      ? `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`
      : null;
  } catch (err) {
    console.warn('[presentation-pdf] Image gen failed:', prompt, err);
    return null;
  }
}
