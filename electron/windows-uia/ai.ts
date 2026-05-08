import { GoogleGenerativeAI } from '@google/generative-ai';
import type { WindowsUIAServiceCore } from './core';

export function getGenAI(service: WindowsUIAServiceCore): GoogleGenerativeAI {
  if (!service.genAI) service.genAI = new GoogleGenerativeAI(service.apiKey);
  return service.genAI;
}
