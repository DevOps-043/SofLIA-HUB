export async function generateGammaPresentationUrl(
  clientCompanyName: string,
  gammaMarkdown: string,
  sendProgress: (message: string) => Promise<void>,
): Promise<string> {
  let presentationUrl = 'https://gamma.app/';
  const gammaApiKey = process.env.VITE_GAMMA_API_KEY || process.env.GAMMA_API_KEY;
  if (!gammaApiKey) return `${presentationUrl} (No se encontro GAMMA_API_KEY en entorno)`;

  try {
    const startRes = await fetch('https://public-api.gamma.app/v1.0/generations', {
      method: 'POST',
      headers: { 'X-API-KEY': gammaApiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Titulo: Propuesta para ${clientCompanyName}\n\nContenido:\n${gammaMarkdown}`,
        textMode: 'preserve',
        format: 'presentation',
        numCards: 3,
        imageOptions: { source: 'web' },
      }),
    });

    if (!startRes.ok) {
      console.error('Gamma API error inicial:', await startRes.text());
      return `${presentationUrl} (Error API Gamma)`;
    }

    const generationId = (await startRes.json()).id;
    if (!generationId) return `${presentationUrl} (No devolvio ID de generacion)`;

    await sendProgress('Gamma App esta procesando las diapositivas. Esto puede tomar unos instantes...');
    return pollGammaGeneration(gammaApiKey, generationId, presentationUrl);
  } catch (error) {
    console.error(error);
    return `${presentationUrl} (Error Red API Gamma)`;
  }
}

async function pollGammaGeneration(apiKey: string, generationId: string, fallbackUrl: string): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const pollRes = await fetch(`https://public-api.gamma.app/v1.0/generations/${generationId}`, {
      method: 'GET',
      headers: { 'X-API-KEY': apiKey },
    });
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    if (pollData.status === 'completed' || pollData.status === 'success') {
      return pollData.gammaUrl || pollData.url || fallbackUrl;
    }
    if (pollData.status === 'failed' || pollData.status === 'error') {
      console.error('Generacion en Gamma fallo:', pollData);
      return `${fallbackUrl} (Generacion fallida en Gamma)`;
    }
  }
  return `${fallbackUrl} (Timeout esperando a Gamma)`;
}
