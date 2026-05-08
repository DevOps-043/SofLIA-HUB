export async function executeNativeAiTool(toolName: string, toolArgs: Record<string, any>, generatedImages: string[]): Promise<string> {
  if (toolName !== 'generate_image') return JSON.stringify({ success: false, error: 'Native tool not implemented' });
  const { generateImage } = await import('../image-generation');
  try {
    const imgResult = await generateImage(toolArgs.prompt);
    if (imgResult.imageData) {
      generatedImages.push(imgResult.imageData);
      return JSON.stringify({ success: true, message: `Imagen generada correctamente: "${toolArgs.prompt}". Sera mostrada automaticamente.` });
    }
    return JSON.stringify({ success: false, error: imgResult.text });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: error.message });
  }
}
