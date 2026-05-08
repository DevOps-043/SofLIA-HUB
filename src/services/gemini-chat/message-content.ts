export function buildMessageContent(finalMessage: string, images?: string[]): any {
  if (!images?.length) return finalMessage;
  const imageParts = images
    .map((imgBase64) => {
      const match = imgBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      let mimeType = match[1];
      if (mimeType === 'application/octet-stream' || mimeType.includes('markdown')) mimeType = 'text/plain';
      return { inlineData: { mimeType, data: match[2] } };
    })
    .filter(Boolean);
  return imageParts.length > 0 ? [finalMessage, ...imageParts] : finalMessage;
}
