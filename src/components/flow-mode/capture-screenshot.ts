export async function captureFlowScreenshot(): Promise<string | undefined> {
  try {
    if (window.screenCapture) {
      const screenshot = await window.screenCapture.captureScreen();
      return screenshot || undefined;
    }
  } catch (error) {
    console.error('Error capturing screen:', error);
  }

  return undefined;
}
