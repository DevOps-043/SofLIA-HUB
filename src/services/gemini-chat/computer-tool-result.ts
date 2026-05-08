import { executeComputerTool } from '../computer-use-service';

export async function executeComputerToolAsJson(toolName: string, toolArgs: Record<string, any>): Promise<string> {
  const rawResult = await executeComputerTool(toolName, toolArgs);
  try {
    const parsed = JSON.parse(rawResult);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? rawResult
      : JSON.stringify({ result: parsed });
  } catch {
    return JSON.stringify({ result: rawResult });
  }
}
